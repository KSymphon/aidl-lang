import { z } from "zod";

/**
 * Contrat entre Grok et le backend. Grok n'écrit rien : il renvoie ce JSON,
 * le backend le valide, vérifie, déduplique, score et décide quoi enregistrer.
 */

export const SCAN_TYPES = ["morning", "noon", "evening"] as const;
export type ScanType = (typeof SCAN_TYPES)[number];

export const CANDIDATE_TYPES = ["creator", "game", "app", "tool", "artist", "project", "other"] as const;

// §22 sans WAIT_AND_WATCH : « à surveiller » est un statut (WATCHING), pas un rejet.
export const REJECTION_REASONS = [
  "LOW_QUALITY",
  "NOT_ORIGINAL",
  "ALREADY_MAINSTREAM",
  "NO_STORY",
  "INSUFFICIENT_EVIDENCE",
  "BRAND_RISK",
  "DUPLICATE",
  "RECENTLY_COVERED",
  "TOO_COMMERCIAL",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

const Rating = z.number().int().min(1).max(5);
const Count = z.number().int().nonnegative().nullable();

export const GrokCandidateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(CANDIDATE_TYPES),
  x_handle: z.string().nullable(),
  evidence_post_url: z.string().min(1),
  evidence_summary: z.string(),
  other_urls: z.array(z.string()),
  declared_followers: Count,
  declared_post_likes: Count,
  declared_post_views: Count,
  why_interesting: z.string(),
  why_underexposed: z.string(),
  why_now: z.string(),
  risks: z.array(z.string()),
  quality: Rating,
  originality: Rating,
  story: Rating,
  facts: z.array(z.string()),
  inferences: z.array(z.string()),
});
export type GrokCandidate = z.infer<typeof GrokCandidateSchema>;

export const GrokDiscardSchema = z.object({
  name: z.string(),
  reason: z.enum(REJECTION_REASONS),
  note: z.string(),
});

export const GrokScanOutputSchema = z.object({
  candidates: z.array(GrokCandidateSchema).max(10),
  discarded: z.array(GrokDiscardSchema).max(30),
  posts_reviewed_estimate: z.number().int().nonnegative(),
  scan_notes: z.string(),
});
export type GrokScanOutput = z.infer<typeof GrokScanOutputSchema>;

/**
 * JSON Schema envoyé à xAI (text.format json_schema, strict).
 * Écrit à la main : pas de minimum/maximum/maxItems, dont le support en mode strict n'est pas garanti ;
 * les bornes sont dans les descriptions et appliquées par zod. test/contract.test.ts vérifie la parité des clés.
 */
const nullableInt = (description: string) => ({ type: ["integer", "null"], description });
const stringArray = (description: string) => ({ type: "array", items: { type: "string" }, description });

export const GROK_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "discarded", "posts_reviewed_estimate", "scan_notes"],
  properties: {
    candidates: {
      type: "array",
      description: "0 à 5 candidats retenus. Zéro est une réponse normale.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "type",
          "x_handle",
          "evidence_post_url",
          "evidence_summary",
          "other_urls",
          "declared_followers",
          "declared_post_likes",
          "declared_post_views",
          "why_interesting",
          "why_underexposed",
          "why_now",
          "risks",
          "quality",
          "originality",
          "story",
          "facts",
          "inferences",
        ],
        properties: {
          name: { type: "string", description: "Nom du projet, du jeu ou du créateur." },
          type: { type: "string", enum: [...CANDIDATE_TYPES] },
          x_handle: { type: ["string", "null"], description: "Handle X du créateur, sans @. null si inconnu." },
          evidence_post_url: {
            type: "string",
            description: "URL exacte d'un post X réellement récupéré par x_search (https://x.com/<handle>/status/<id>). Ne jamais construire d'URL.",
          },
          evidence_summary: { type: "string", description: "Ce que montre ce post, en une ou deux phrases." },
          other_urls: stringArray("URLs vues dans les posts (Steam, itch.io, site officiel). Vide si aucune."),
          declared_followers: nullableInt("Nombre d'abonnés du créateur lu dans un résultat d'outil, sinon null."),
          declared_post_likes: nullableInt("Likes du post de preuve lus dans un résultat d'outil, sinon null."),
          declared_post_views: nullableInt("Vues du post de preuve lues dans un résultat d'outil, sinon null."),
          why_interesting: { type: "string" },
          why_underexposed: { type: "string" },
          why_now: { type: "string" },
          risks: stringArray("Risques ou objections. Vide si aucun."),
          quality: { type: "integer", description: "1 à 5 selon la grille du prompt." },
          originality: { type: "integer", description: "1 à 5 selon la grille du prompt." },
          story: { type: "integer", description: "1 à 5 : histoire racontable en 15–45 s." },
          facts: stringArray("Faits observés directement dans les résultats d'outils."),
          inferences: stringArray("Déductions ou intuitions, clairement séparées des faits."),
        },
      },
    },
    discarded: {
      type: "array",
      description: "Jusqu'à 10 exemples écartés, avec un code de raison.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "reason", "note"],
        properties: {
          name: { type: "string" },
          reason: { type: "string", enum: [...REJECTION_REASONS] },
          note: { type: "string" },
        },
      },
    },
    posts_reviewed_estimate: { type: "integer", description: "Nombre approximatif de posts examinés." },
    scan_notes: { type: "string", description: "Une ou deux phrases sur le scan (qualité du vivier, difficultés)." },
  },
} as const;

// ---- Sortie du pipeline (ce que voit le dashboard) ----

export type SuggestedDecision = "SHORTLIST" | "WATCH" | "REJECT";

export type ExposureBucket = "unknown" | "nano" | "micro" | "small" | "mid" | "large";

export type VerificationFlag =
  | "EVIDENCE_NOT_X_POST"
  | "EVIDENCE_NOT_CITED"
  | "OUTSIDE_WINDOW"
  | "HANDLE_MISMATCH"
  | "NO_HANDLE"
  | "METRICS_DECLARED_BY_MODEL"
  | "NO_SEARCH_PERFORMED"
  | "DUPLICATE_IN_SCAN"
  | "SEEN_BEFORE"
  | "RISK_NOTED";

export interface ScoredCandidate {
  source: GrokCandidate;
  handle: string | null;
  keys: string[];
  evidence: {
    url: string;
    canonical_url: string | null;
    author_handle: string | null;
    post_id: string | null;
    posted_at: string | null;
    cited: boolean;
  };
  exposure: {
    bucket: ExposureBucket;
    followers_declared: number | null;
    verified: false;
  };
  merit: number;
  priority: number;
  decision: SuggestedDecision;
  rejection_reason: RejectionReason | null;
  flags: VerificationFlag[];
  summary_line: string;
  seen_before: { first_seen_at: string; times_seen: number } | null;
}

export interface ScanUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  x_posts_fetched: number | null;
  x_users_fetched: number | null;
  x_search_calls: number;
  web_search_calls: number;
  cost_usd_actual: number | null;
  cost_usd_estimated: number;
  usage_details_present: boolean;
}

export interface ScanReport {
  scan_id: string;
  mode: "live" | "replay";
  type: ScanType;
  vertical: string;
  model: string;
  prompt_version: string;
  started_at: string;
  completed_at: string;
  window: { from_date: string; to_date: string };
  intents: string[];
  status: "succeeded" | "failed";
  error: { code: string; message: string } | null;
  usage: ScanUsage | null;
  alerts: string[];
  tool_queries: string[];
  candidates: ScoredCandidate[];
  discarded: z.infer<typeof GrokDiscardSchema>[];
  posts_reviewed_estimate: number | null;
  scan_notes: string | null;
  counts: { returned: number; shortlist: number; watch: number; reject: number };
}
