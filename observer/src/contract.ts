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

export const MAX_CANDIDATES = 5;
export const MAX_DISCARDED = 10;

export const GrokScanOutputSchema = z.object({
  candidates: z.array(GrokCandidateSchema).max(MAX_CANDIDATES),
  discarded: z.array(GrokDiscardSchema).max(MAX_DISCARDED),
  posts_reviewed_estimate: z.number().int().nonnegative(),
  scan_notes: z.string(),
});
export type GrokScanOutput = z.infer<typeof GrokScanOutputSchema>;

const EnvelopeSchema = z.object({
  candidates: z.array(z.unknown()),
  discarded: z.array(z.unknown()),
  posts_reviewed_estimate: z.number().int().nonnegative(),
  scan_notes: z.string(),
});

/**
 * Validation élément par élément : un candidat hors contrat est écarté (et signalé) sans faire perdre
 * les autres, alors que le scan a déjà été facturé.
 */
export function parseGrokOutput(
  json: unknown,
): { ok: true; output: GrokScanOutput; dropped: string[] } | { ok: false; issues: string } {
  const env = EnvelopeSchema.safeParse(json);
  if (!env.success) {
    return {
      ok: false,
      issues: env.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  const dropped: string[] = [];
  const candidates: GrokCandidate[] = [];
  env.data.candidates.forEach((raw, i) => {
    const r = GrokCandidateSchema.safeParse(raw);
    if (r.success) candidates.push(r.data);
    else dropped.push(`candidat ${i} : ${r.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join(", ")}`);
  });
  if (candidates.length > MAX_CANDIDATES) {
    dropped.push(`${candidates.length - MAX_CANDIDATES} candidat(s) au-delà de ${MAX_CANDIDATES} ignoré(s)`);
  }
  const discarded = env.data.discarded
    .map((raw) => GrokDiscardSchema.safeParse(raw))
    .filter((r) => r.success)
    .map((r) => r.data)
    .slice(0, MAX_DISCARDED);
  return {
    ok: true,
    output: {
      candidates: candidates.slice(0, MAX_CANDIDATES),
      discarded,
      posts_reviewed_estimate: env.data.posts_reviewed_estimate,
      scan_notes: env.data.scan_notes,
    },
    dropped,
  };
}

/**
 * JSON Schema envoyé à xAI (text.format json_schema, strict).
 * Écrit à la main. Les notes sont des enum 1–5 et les tableaux ont un maxItems (supportés par le moteur de
 * sortie structurée de xAI) ; zod revérifie tout côté code. test/contract-usage.test.ts vérifie la parité des clés.
 */
const nullableInt = (description: string) => ({ type: ["integer", "null"], description });
const RATINGS = [1, 2, 3, 4, 5];
const stringArray = (description: string) => ({ type: "array", items: { type: "string" }, description });

export const GROK_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "discarded", "posts_reviewed_estimate", "scan_notes"],
  properties: {
    candidates: {
      type: "array",
      description: "0 à 5 candidats retenus. Zéro est une réponse normale.",
      maxItems: MAX_CANDIDATES,
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
          other_urls: stringArray(
            "URLs lues telles quelles dans les posts récupérés (Steam, itch.io, site officiel). Ne jamais en construire. Vide si aucune.",
          ),
          declared_followers: nullableInt("Nombre d'abonnés du créateur lu dans un résultat d'outil, sinon null."),
          declared_post_likes: nullableInt("Likes du post de preuve lus dans un résultat d'outil, sinon null."),
          declared_post_views: nullableInt("Vues du post de preuve lues dans un résultat d'outil, sinon null."),
          why_interesting: { type: "string" },
          why_underexposed: { type: "string" },
          why_now: { type: "string" },
          risks: stringArray("Risques ou objections. Vide si aucun."),
          quality: { type: "integer", enum: RATINGS, description: "1 à 5 selon la grille du prompt." },
          originality: { type: "integer", enum: RATINGS, description: "1 à 5 selon la grille du prompt." },
          story: { type: "integer", enum: RATINGS, description: "1 à 5 : histoire racontable en 15–45 s." },
          facts: stringArray("Faits observés directement dans les résultats d'outils."),
          inferences: stringArray("Déductions ou intuitions, clairement séparées des faits."),
        },
      },
    },
    discarded: {
      type: "array",
      description:
        "Jusqu'à 10 exemples écartés, avec un code de raison. Pour un compte écarté pour vie privée, données sensibles ou parce qu'il semble tenu par un mineur : name = \"compte écarté\", sans handle ni détail personnel.",
      maxItems: MAX_DISCARDED,
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
