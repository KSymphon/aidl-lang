import type { Config } from "./config";
import {
  GrokScanOutputSchema,
  type GrokScanOutput,
  type ScanReport,
  type ScanType,
  type ScoredCandidate,
  type ScanUsage,
  type VerificationFlag,
} from "./contract";
import { keysFor, groupDuplicates } from "./dedupe";
import { extractResponse, toolQuery, type ExtractedResponse } from "./extract";
import { assertCanScan, fmtUsd } from "./budget";
import { PROMPT_VERSION, buildSystemPrompt, buildUserPrompt, scanWindow } from "./prompt";
import { exposureBucket, priorityOf, suggestDecision, summaryLine } from "./score";
import type { SavedScan, SeenEntry, Store } from "./store";
import { billedCost, parseUsage } from "./usage";
import { checkEvidence, citationKeySet, normalizeHandle } from "./verify";
import { getVertical, pickIntents, type Vertical } from "./verticals";
import { XaiApiError, buildRequestBody, callResponses, type FetchLike } from "./xai-client";

export interface ScanDeps {
  config: Config;
  store: Store;
  fetchImpl?: FetchLike;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

const LOCK_STALE_MS = 15 * 60_000;
const DECISION_ORDER = { SHORTLIST: 0, WATCH: 1, REJECT: 2 } as const;

function scanId(now: Date, type: ScanType): string {
  return `scan_${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}_${type}`;
}

/** Prépare la requête sans rien appeler (utilisé par --dry-run et par runLiveScan). */
export function prepareScan(type: ScanType, verticalId: string, config: Config, now: Date) {
  const vertical = getVertical(verticalId);
  const window = scanWindow(type, now);
  const intents = pickIntents(vertical, type, window.to_date);
  const prompts = { system: buildSystemPrompt(), user: buildUserPrompt({ type, vertical, intents, window }) };
  const body = buildRequestBody(config, prompts, { ...window, excluded_x_handles: vertical.excludedHandles });
  return { vertical, window, intents, body };
}

export async function runLiveScan(
  opts: { type: ScanType; vertical: string },
  deps: ScanDeps,
): Promise<{ report: ScanReport; file: string }> {
  const { config, store } = deps;
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const prep = prepareScan(opts.type, opts.vertical, config, startedAt);
  const id = scanId(startedAt, opts.type);

  const release = await store.acquireLock(LOCK_STALE_MS);
  try {
    assertCanScan(await store.readLedger(), config, startedAt);

    const base = {
      scan_id: id,
      mode: "live" as const,
      type: opts.type,
      vertical: prep.vertical.id,
      model: config.XAI_MODEL,
      prompt_version: PROMPT_VERSION,
      started_at: startedAt.toISOString(),
      window: prep.window,
      intents: prep.intents.map((i) => i.id),
    };

    let raw: unknown;
    try {
      raw = (await callResponses(config, prep.body, deps.fetchImpl, deps.sleep)).raw;
    } catch (err) {
      if (!(err instanceof XaiApiError)) throw err;
      const mayBeBilled = err.code === "TIMEOUT" || err.code === "NETWORK" || (err.httpStatus ?? 0) >= 500;
      const report: ScanReport = {
        ...base,
        completed_at: now().toISOString(),
        status: "failed",
        error: { code: err.code, message: err.message },
        usage: null,
        alerts: mayBeBilled
          ? ["Le scan a pu être exécuté et facturé malgré l'erreur : vérifier la consommation dans la console xAI."]
          : [],
        tool_queries: [],
        candidates: [],
        discarded: [],
        posts_reviewed_estimate: null,
        scan_notes: null,
        counts: { returned: 0, shortlist: 0, watch: 0, reject: 0 },
      };
      const file = await store.saveScan({ report, request: prep.body, response_raw: null });
      return { report, file };
    }

    const seen = await store.readSeen();
    const processed = processResponse(raw, {
      config,
      windowStart: new Date(`${prep.window.from_date}T00:00:00Z`),
      seen,
      vertical: prep.vertical,
    });

    const report: ScanReport = { ...base, completed_at: now().toISOString(), ...processed };
    if (processed.usage) {
      await store.appendLedger({
        scan_id: id,
        at: startedAt.toISOString(),
        cost_usd: billedCost(processed.usage),
        source: processed.usage.cost_usd_actual === null ? "estimated" : "actual",
      });
    }
    await store.writeSeen(updateSeen(seen, report.candidates, startedAt));
    const file = await store.saveScan({ report, request: prep.body, response_raw: raw });
    return { report, file };
  } finally {
    await release();
  }
}

/**
 * Rejoue le pipeline (extraction → vérification → score) sur une réponse déjà sauvegardée, sans appel
 * ni dépense. Sert à itérer sur le code sans brûler l'API. Ne touche ni au budget ni à l'historique.
 */
export async function replayScan(
  saved: unknown,
  fallback: { type: ScanType; vertical: string },
  deps: ScanDeps,
): Promise<{ report: ScanReport; file: string }> {
  const now = deps.now ?? (() => new Date());
  const isSaved = typeof saved === "object" && saved !== null && "response_raw" in saved && "report" in saved;
  const prior = isSaved ? (saved as SavedScan).report : null;
  const raw = isSaved ? (saved as SavedScan).response_raw : saved;
  const startedAt = now();
  const window = prior?.window ?? scanWindow(fallback.type, startedAt);
  const type = prior?.type ?? fallback.type;

  const processed = processResponse(raw, {
    config: { ...deps.config, XAI_MODEL: prior?.model ?? deps.config.XAI_MODEL },
    windowStart: new Date(`${window.from_date}T00:00:00Z`),
    seen: await deps.store.readSeen(),
    vertical: getVertical(prior?.vertical ?? fallback.vertical),
  });
  const report: ScanReport = {
    scan_id: `${prior?.scan_id ?? scanId(startedAt, type)}_replay_${startedAt.toISOString().replace(/[-:.]/g, "").slice(0, 15)}`,
    mode: "replay",
    type,
    vertical: prior?.vertical ?? fallback.vertical,
    model: prior?.model ?? deps.config.XAI_MODEL,
    prompt_version: prior?.prompt_version ?? PROMPT_VERSION,
    started_at: startedAt.toISOString(),
    completed_at: now().toISOString(),
    window,
    intents: prior?.intents ?? [],
    ...processed,
  };
  const file = await deps.store.saveScan({ report, request: null, response_raw: raw });
  return { report, file };
}

type Processed = Pick<
  ScanReport,
  | "status"
  | "error"
  | "usage"
  | "alerts"
  | "tool_queries"
  | "candidates"
  | "discarded"
  | "posts_reviewed_estimate"
  | "scan_notes"
  | "counts"
>;

export function processResponse(
  raw: unknown,
  ctx: { config: Config; windowStart: Date; seen: Record<string, SeenEntry>; vertical: Vertical },
): Processed {
  const extracted = extractResponse(raw);
  const usage = parseUsage(raw, ctx.config.XAI_MODEL, extracted.toolCalls);
  const alerts = usageAlerts(usage, extracted, ctx.config);
  const tool_queries = extracted.toolCalls.map(toolQuery);
  const empty = { returned: 0, shortlist: 0, watch: 0, reject: 0 };

  const fail = (code: string, message: string): Processed => ({
    status: "failed",
    error: { code, message },
    usage,
    alerts,
    tool_queries,
    candidates: [],
    discarded: [],
    posts_reviewed_estimate: null,
    scan_notes: null,
    counts: empty,
  });

  if (!extracted.outputText) return fail("NO_FINAL_MESSAGE", "La réponse ne contient pas de message final.");
  let json: unknown;
  try {
    json = JSON.parse(extracted.outputText);
  } catch {
    return fail("INVALID_JSON", `Sortie non JSON : ${extracted.outputText.slice(0, 200)}`);
  }
  const parsed = GrokScanOutputSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return fail("INVALID_OUTPUT", `Sortie hors contrat — ${issues}`);
  }

  const searchPerformed = usage.x_search_calls > 0 || (usage.x_posts_fetched ?? 0) > 0;
  if (!searchPerformed && parsed.data.candidates.length > 0) {
    alerts.push("Aucune recherche X détectée mais des candidats renvoyés : tous rejetés (hallucination probable).");
  }
  const candidates = scoreCandidates(parsed.data, {
    citationKeys: citationKeySet(extracted.citations),
    windowStart: ctx.windowStart,
    searchPerformed,
    seen: ctx.seen,
    vertical: ctx.vertical,
  });

  return {
    status: "succeeded",
    error: null,
    usage,
    alerts,
    tool_queries,
    candidates,
    discarded: parsed.data.discarded,
    posts_reviewed_estimate: parsed.data.posts_reviewed_estimate,
    scan_notes: parsed.data.scan_notes,
    counts: {
      returned: candidates.length,
      shortlist: candidates.filter((c) => c.decision === "SHORTLIST").length,
      watch: candidates.filter((c) => c.decision === "WATCH").length,
      reject: candidates.filter((c) => c.decision === "REJECT").length,
    },
  };
}

function scoreCandidates(
  output: GrokScanOutput,
  ctx: {
    citationKeys: Set<string>;
    windowStart: Date;
    searchPerformed: boolean;
    seen: Record<string, SeenEntry>;
    vertical: Vertical;
  },
): ScoredCandidate[] {
  const pre = output.candidates.map((c) => {
    const ev = checkEvidence(c, ctx);
    const flags: VerificationFlag[] = [...ev.flags];
    if (!ctx.searchPerformed) flags.push("NO_SEARCH_PERFORMED");
    if (c.risks.length > 0) flags.push("RISK_NOTED");
    const handle = normalizeHandle(c.x_handle) ?? (flags.includes("HANDLE_MISMATCH") ? null : ev.author_handle);
    const keys = keysFor({ x_handle: handle, urls: c.other_urls });
    const bucket = exposureBucket(c.declared_followers, ctx.vertical.exposure);
    const priority = priorityOf(c, bucket);
    const verified = ev.cited && ctx.searchPerformed && ev.post_id !== null;
    return { c, ev, flags, handle, keys, bucket, priority, verified };
  });

  // Un candidat vérifié l'emporte toujours sur un doublon non vérifié.
  const reps = groupDuplicates(
    pre.map((p) => p.keys),
    pre.map((p) => p.priority + (p.verified ? 1000 : 0)),
  );

  const scored = pre.map((p, i): ScoredCandidate => {
    if (reps[i] !== i) p.flags.push("DUPLICATE_IN_SCAN");
    const seenBefore = lookupSeen(ctx.seen, p.keys);
    if (seenBefore) p.flags.push("SEEN_BEFORE");
    const d = suggestDecision(p.c, p.bucket, p.flags);
    return {
      source: p.c,
      handle: p.handle,
      keys: p.keys,
      evidence: {
        url: p.c.evidence_post_url,
        canonical_url: p.ev.canonical_url,
        author_handle: p.ev.author_handle,
        post_id: p.ev.post_id,
        posted_at: p.ev.posted_at,
        cited: p.ev.cited,
      },
      exposure: { bucket: p.bucket, followers_declared: p.c.declared_followers, verified: false },
      merit: (p.c.quality + p.c.originality) / 2,
      priority: p.priority,
      decision: d.decision,
      rejection_reason: d.reason,
      flags: p.flags,
      summary_line: summaryLine(p.c, p.bucket, d.note),
      seen_before: seenBefore,
    };
  });

  return scored.sort(
    (a, b) => DECISION_ORDER[a.decision] - DECISION_ORDER[b.decision] || b.priority - a.priority,
  );
}

function lookupSeen(seen: Record<string, SeenEntry>, keys: string[]): ScoredCandidate["seen_before"] {
  const hits = keys.map((k) => seen[k]).filter((e): e is SeenEntry => e !== undefined);
  if (hits.length === 0) return null;
  return {
    first_seen_at: hits.map((h) => h.first_seen_at).sort()[0]!,
    times_seen: Math.max(...hits.map((h) => h.times_seen)),
  };
}

/** Seuls les candidats dont la preuve est vérifiée entrent dans l'historique (pas d'identité hallucinée). */
export function updateSeen(
  seen: Record<string, SeenEntry>,
  candidates: ScoredCandidate[],
  at: Date,
): Record<string, SeenEntry> {
  const next = { ...seen };
  const iso = at.toISOString();
  for (const c of candidates) {
    if (c.rejection_reason === "INSUFFICIENT_EVIDENCE") continue;
    for (const k of c.keys) {
      const prev = next[k];
      next[k] = {
        first_seen_at: prev?.first_seen_at ?? iso,
        last_seen_at: iso,
        times_seen: (prev?.times_seen ?? 0) + 1,
        last_decision: c.decision,
      };
    }
  }
  return next;
}

function usageAlerts(usage: ScanUsage, extracted: ExtractedResponse, config: Config): string[] {
  const alerts: string[] = [];
  if (!usage.usage_details_present) {
    alerts.push("usage.server_side_tool_usage_details absent : nombre de posts facturés inconnu (coût estimé partiel).");
  }
  if ((usage.x_posts_fetched ?? 0) > config.OBSERVER_ALERT_POSTS) {
    alerts.push(`${usage.x_posts_fetched} posts facturés (seuil d'alerte : ${config.OBSERVER_ALERT_POSTS}).`);
  }
  const cost = billedCost(usage);
  if (cost > config.OBSERVER_ALERT_SCAN_USD) {
    alerts.push(`Coût du scan ${fmtUsd(cost)} au-dessus du seuil d'alerte (${fmtUsd(config.OBSERVER_ALERT_SCAN_USD)}).`);
  }
  if (usage.cost_usd_actual !== null && usage.cost_usd_estimated > 0.01 && usage.cost_usd_actual > 0.01) {
    const ratio = usage.cost_usd_actual / usage.cost_usd_estimated;
    if (ratio > 5 || ratio < 0.2) {
      alerts.push(
        `Écart réel/estimé ×${ratio.toFixed(2)} : vérifier l'unité de cost_in_usd_ticks et la grille de PRICING (config.ts).`,
      );
    }
  }
  if (extracted.toolCalls.some((c) => c.name === "x_thread_fetch")) {
    alerts.push("Un thread complet a été récupéré malgré la consigne (chaque post du thread est facturé).");
  }
  if (extracted.toolCalls.some((c) => c.kind === "function")) {
    alerts.push("Appel de fonction client inattendu : aucune fonction n'est déclarée, à investiguer.");
  }
  if (extracted.citations.length === 0) {
    alerts.push("Aucune citation trouvée dans la réponse : aucune preuve ne pourra être vérifiée (format à contrôler dans la réponse brute).");
  }
  if (extracted.status && extracted.status !== "completed") {
    alerts.push(`Statut de réponse xAI : ${extracted.status}.`);
  }
  return alerts;
}
