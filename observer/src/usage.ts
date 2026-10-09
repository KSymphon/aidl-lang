import { PRICING, USD_TICKS } from "./config";
import type { ScanUsage } from "./contract";
import type { ToolCallInfo } from "./extract";

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Coût d'un scan. Le coût RÉEL est usage.cost_in_usd_ticks (1 USD = 1e10 ticks), qui inclut tokens,
 * cache et outils serveur. L'estimation (tarifs de config.ts) sert de contrôle de cohérence et de repli.
 */
export function parseUsage(raw: unknown, model: string, toolCalls: ToolCallInfo[]): ScanUsage {
  const usage = isObject(raw) && isObject(raw.usage) ? raw.usage : {};
  const inDetails = isObject(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outDetails = isObject(usage.output_tokens_details) ? usage.output_tokens_details : {};
  const tools = isObject(usage.server_side_tool_usage_details) ? usage.server_side_tool_usage_details : null;

  const input = num(usage.input_tokens) ?? num(usage.prompt_tokens) ?? 0;
  const cached = num(inDetails.cached_tokens) ?? num(usage.cached_prompt_text_tokens) ?? 0;
  const output = num(usage.output_tokens) ?? num(usage.completion_tokens) ?? 0;
  const reasoning = num(outDetails.reasoning_tokens) ?? num(usage.reasoning_tokens) ?? 0;

  const xCallsFromItems = toolCalls.filter((c) => c.kind === "x_search").length;
  const webCallsFromItems = toolCalls.filter((c) => c.kind === "web_search").length;

  const xPosts = tools ? num(tools.x_posts_fetched) : null;
  const xUsers = tools ? num(tools.x_users_fetched) : null;
  const xCalls = (tools ? num(tools.x_search_calls) : null) ?? xCallsFromItems;
  const webCalls = (tools ? num(tools.web_search_calls) : null) ?? webCallsFromItems;

  const ticks = num(usage.cost_in_usd_ticks);
  const price = PRICING.models[model] ?? PRICING.fallbackModel;
  // input_tokens inclut normalement les tokens en cache ; sinon on les additionne (même règle que l'AI SDK).
  const cachedIncluded = cached <= input;
  const uncachedInput = cachedIncluded ? input - cached : input;
  const estimated =
    (uncachedInput * price.input + cached * price.cachedInput + output * price.output) / 1e6 +
    (xPosts ?? 0) * PRICING.xPostUsd +
    (xUsers ?? 0) * PRICING.xUserUsd +
    webCalls * PRICING.webSearchCallUsd;

  return {
    input_tokens: cachedIncluded ? input : input + cached,
    cached_input_tokens: cached,
    output_tokens: output,
    reasoning_tokens: reasoning,
    x_posts_fetched: xPosts,
    x_users_fetched: xUsers,
    x_search_calls: xCalls,
    web_search_calls: webCalls,
    cost_usd_actual: ticks === null ? null : ticks / USD_TICKS,
    cost_usd_estimated: round4(estimated),
    usage_details_present: tools !== null,
  };
}

/** Montant retenu pour le budget : le réel s'il existe, sinon l'estimation. */
export function billedCost(u: ScanUsage): number {
  return u.cost_usd_actual ?? u.cost_usd_estimated;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
