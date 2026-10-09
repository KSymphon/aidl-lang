import type { Config } from "./config";
import { GROK_OUTPUT_JSON_SCHEMA } from "./contract";

/**
 * Client REST minimal pour POST /v1/responses.
 * Pas de SDK : il faut lire le JSON brut de usage (server_side_tool_usage_details, cost_in_usd_ticks),
 * que tous les wrappers n'exposent pas. Pas de search_parameters (Live Search retirée, HTTP 410).
 */

export interface XSearchToolOptions {
  from_date: string;
  to_date: string;
  excluded_x_handles: string[];
}

export function buildRequestBody(
  config: Config,
  prompts: { system: string; user: string },
  xSearch: XSearchToolOptions,
): Record<string, unknown> {
  return {
    model: config.XAI_MODEL,
    input: [
      { role: "system", content: prompts.system },
      { role: "user", content: [{ type: "input_text", text: prompts.user }] },
    ],
    // Uniquement x_search : aucune fonction client, donc aucune capacité d'écriture pour le modèle.
    tools: [
      {
        type: "x_search",
        from_date: xSearch.from_date,
        to_date: xSearch.to_date,
        ...(xSearch.excluded_x_handles.length > 0 && {
          excluded_x_handles: xSearch.excluded_x_handles.slice(0, 20),
        }),
        enable_image_understanding: false,
        enable_video_understanding: false,
      },
    ],
    max_turns: config.OBSERVER_MAX_TURNS,
    parallel_tool_calls: config.OBSERVER_PARALLEL_TOOL_CALLS,
    // grok-4.7 raisonne en HIGH par défaut : on baisse l'effort pour limiter les tokens.
    reasoning: { effort: config.XAI_REASONING_EFFORT },
    text: {
      format: {
        type: "json_schema",
        name: "observer_scan",
        strict: true,
        schema: GROK_OUTPUT_JSON_SCHEMA,
      },
    },
    store: config.OBSERVER_STORE_AT_XAI,
  };
}

export class XaiApiError extends Error {
  constructor(
    readonly code: "HTTP_ERROR" | "TIMEOUT" | "NETWORK" | "BAD_JSON",
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "XaiApiError";
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface CallResult {
  raw: unknown;
  httpStatus: number;
  durationMs: number;
  attempts: number;
}

/**
 * Un seul nouvel essai, et seulement sur HTTP 429 (requête non traitée, donc non facturée).
 * Pas de nouvel essai sur 5xx ni sur coupure réseau : le scan a pu tourner et être facturé,
 * et doubler la dépense en silence est exclu (§17).
 */
export async function callResponses(
  config: Config,
  body: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<CallResult> {
  if (!config.XAI_API_KEY) {
    throw new XaiApiError("HTTP_ERROR", "XAI_API_KEY absent : impossible de lancer un scan réel.");
  }
  const url = `${config.XAI_BASE_URL.replace(/\/+$/, "")}/responses`;
  const started = Date.now();
  let attempts = 0;

  for (;;) {
    attempts += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.OBSERVER_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.XAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new XaiApiError("TIMEOUT", `Pas de réponse de xAI après ${config.OBSERVER_TIMEOUT_MS} ms.`);
      }
      throw new XaiApiError("NETWORK", `Erreur réseau vers xAI : ${(err as Error).message}`);
    }

    let text: string;
    try {
      text = await res.text();
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new XaiApiError("TIMEOUT", `Réponse de xAI interrompue après ${config.OBSERVER_TIMEOUT_MS} ms.`);
      }
      throw new XaiApiError("NETWORK", `Lecture de la réponse xAI impossible : ${(err as Error).message}`);
    }
    clearTimeout(timer);

    if (res.status === 429 && attempts === 1) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 5000);
      continue;
    }
    if (!res.ok) {
      throw new XaiApiError("HTTP_ERROR", `xAI a répondu ${res.status} : ${text.slice(0, 500)}`, res.status);
    }
    try {
      return { raw: JSON.parse(text), httpStatus: res.status, durationMs: Date.now() - started, attempts };
    } catch {
      throw new XaiApiError("BAD_JSON", `Réponse xAI non JSON : ${text.slice(0, 200)}`, res.status);
    }
  }
}
