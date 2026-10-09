import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const EnvSchema = z.object({
  XAI_API_KEY: z.string().trim().min(1).optional(),
  XAI_BASE_URL: z.url().default("https://api.x.ai/v1"),
  XAI_MODEL: z.string().min(1).default("grok-4.7"),
  XAI_REASONING_EFFORT: z.enum(["none", "low", "medium", "high", "xhigh"]).default("low"),
  // Seul levier de plafond côté requête : x_search n'a pas de max_results (voir docs/X-DISCOVERY.md).
  OBSERVER_MAX_TURNS: z.coerce.number().int().min(1).max(10).default(3),
  OBSERVER_PARALLEL_TOOL_CALLS: bool.default(true),
  OBSERVER_TIMEOUT_MS: z.coerce.number().int().min(10_000).default(300_000),
  OBSERVER_DAILY_BUDGET_USD: z.coerce.number().positive().default(5),
  // Montant réservé avant chaque scan : un scan est refusé si dépensé + réserve > budget du jour.
  OBSERVER_SCAN_RESERVE_USD: z.coerce.number().positive().default(2),
  OBSERVER_ALERT_POSTS: z.coerce.number().int().positive().default(150),
  OBSERVER_ALERT_SCAN_USD: z.coerce.number().positive().default(1),
  OBSERVER_DATA_DIR: z.string().min(1).default("data"),
  // Rétention côté xAI désactivée par défaut (minimisation RGPD).
  OBSERVER_STORE_AT_XAI: bool.default(false),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ""),
  );
  const parsed = EnvSchema.safeParse(present);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuration invalide — ${issues}`);
  }
  return parsed.data;
}

/**
 * Tarifs xAI en USD. Vérifiés le 2026-10-06 sur docs.x.ai/developers/pricing ;
 * X Search est facturé par élément depuis le 2026-09-21. À relire avant de figer un budget.
 * Le coût réel vient de usage.cost_in_usd_ticks ; ces prix ne servent qu'à l'estimation.
 */
export const PRICING = {
  verifiedOn: "2026-10-06",
  xPostUsd: 0.005,
  xUserUsd: 0.01,
  webSearchCallUsd: 0.005,
  // USD par million de tokens (prompt < 200k).
  models: {
    "grok-4.7": { input: 2, cachedInput: 0.5, output: 6 },
    "grok-4.6": { input: 2, cachedInput: 0.5, output: 6 },
    "grok-4.5": { input: 2, cachedInput: 0.3, output: 6 },
    "grok-4.3": { input: 1.25, cachedInput: 0.2, output: 2.5 },
  } as Record<string, { input: number; cachedInput: number; output: number }>,
  fallbackModel: { input: 2, cachedInput: 0.5, output: 6 },
} as const;

export const USD_TICKS = 1e10;
