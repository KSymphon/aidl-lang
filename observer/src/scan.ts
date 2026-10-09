import type { Config } from "./config";
import {
  parseGrokOutput,
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
import { billedCost, costMismatch, parseUsage } from "./usage";
import { checkEvidence, citationKeySet, citedXAuthors, normalizeHandle } from "./verify";
import { getVertical, pickIntents, type Vertical } from "./verticals";
import { XaiApiError, buildRequestBody, callResponses, type FetchLike } from "./xai-client";

export interface ScanDeps {
  config: Config;
  store: Store;
  fetchImpl?: FetchLike;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

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

  // Péremption du verrou au-delà de la durée maximale d'un scan (un nouvel essai sur 429 compris).
  const release = await store.acquireLock(2 * config.OBSERVER_TIMEOUT_MS + 60_000);
  try {
    assertCanScan(await store.readLedger(), config, startedAt);
    const at = startedAt.toISOString();
    const reserve = config.OBSERVER_SCAN_RESERVE_USD;
    // Réservé AVANT l'appel : si le processus meurt pendant le scan, la dépense possible reste comptée.
    await store.recordLedger({ scan_id: id, at, cost_usd: reserve, source: "reserved" });

    const base = {
      scan_id: id,
      mode: "live" as const,
      type: opts.type,
      vertical: prep.vertical.id,
      model: config.XAI_MODEL,
      prompt_version: PROMPT_VERSION,
      started_at: at,
      window: prep.window,
      intents: prep.intents.map((i) => i.id),
    };

    let raw: unknown;
    try {
      raw = (await callResponses(config, prep.body, deps.fetchImpl, deps.sleep)).raw;
    } catch (err) {
      if (!(err instanceof XaiApiError)) throw err;
      const status = err.httpStatus ?? 0;
      const mayBeBilled =
        err.code === "TIMEOUT" || err.code === "NETWORK" || status >= 500 || (err.code === "BAD_JSON" && status < 300);
      // Facturation possible : la réserve reste au budget. Sinon (4xx), elle est libérée.
      if (!mayBeBilled) await store.recordLedger({ scan_id: id, at, cost_usd: 0, source: "released" });
      const report: ScanReport = {
        ...base,
        completed_at: now().toISOString(),
        status: "failed",
        error: { code: err.code, message: err.message },
        usage: null,
        alerts: mayBeBilled
          ? [
              `Le scan a pu être exécuté et facturé malgré l'erreur : la réserve (${fmtUsd(reserve)}) reste comptée dans le budget du jour. Vérifier la consommation réelle dans la console xAI.`,
            ]
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

    // Coût inscrit dès réception, avant tout traitement qui pourrait échouer.
    const usage = parseUsage(raw, config.XAI_MODEL, extractResponse(raw).toolCalls);
    await store.recordLedger({
      scan_id: id,
      at,
      cost_usd: billedCost(usage, reserve),
      source: usage.cost_usd_actual === null ? "estimated" : "actual",
    });

    const seen = await store.readSeen();
    const processed = processResponse(raw, {
      config,
      windowStart: new Date(`${prep.window.from_date}T00:00:00Z`),
      seen,
      vertical: prep.vertical,
    });

    const report: ScanReport = { ...base, completed_at: now().toISOString(), ...processed };
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

  // L'historique ne doit contenir que ce qui précédait le scan rejoué, sinon il se voit « déjà vu » par lui-même.
  const seenNow = await deps.store.readSeen();
  const seen = prior
    ? Object.fromEntries(Object.entries(seenNow).filter(([, e]) => e.first_seen_at < prior.started_at))
    : seenNow;
  const processed = processResponse(raw, {
    config: { ...deps.config, XAI_MODEL: prior?.model ?? deps.config.XAI_MODEL },
    windowStart: new Date(`${window.from_date}T00:00:00Z`),
    seen,
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
  const json = parseModelJson(extracted.outputText);
  if (json === undefined) return fail("INVALID_JSON", `Sortie non JSON : ${extracted.outputText.slice(0, 200)}`);
  const parsed = parseGrokOutput(json);
  if (!parsed.ok) return fail("INVALID_OUTPUT", `Sortie hors contrat — ${parsed.issues}`);
  for (const d of parsed.dropped) alerts.push(`Écarté car hors contrat : ${d}.`);

  const searchPerformed = usage.x_search_calls > 0 || (usage.x_posts_fetched ?? 0) > 0;
  if (!searchPerformed && parsed.output.candidates.length > 0) {
    alerts.push("Aucune recherche X détectée mais des candidats renvoyés : tous rejetés (hallucination probable).");
  }
  const candidates = scoreCandidates(parsed.output, {
    citationKeys: citationKeySet(extracted.citations),
    citedAuthors: citedXAuthors(extracted.citations),
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
    discarded: parsed.output.discarded,
    posts_reviewed_estimate: parsed.output.posts_reviewed_estimate,
    scan_notes: parsed.output.scan_notes,
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
    citedAuthors: Map<string, string>;
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
    // L'auteur du post de preuve n'est pas forcément le créateur (curateur, fan) : pas d'identité déduite.
    const handle = normalizeHandle(c.x_handle);
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

/**
 * Historique des sujets vus. Seuls les candidats dont le post de preuve est vérifié y entrent ; leurs clés
 * (handle, URLs) restent déclarées par le modèle. Chaque clé compte une fois par scan, avec la meilleure
 * décision (les candidats arrivent triés SHORTLIST → WATCH → REJECT).
 */
export function updateSeen(
  seen: Record<string, SeenEntry>,
  candidates: ScoredCandidate[],
  at: Date,
): Record<string, SeenEntry> {
  const next = { ...seen };
  const iso = at.toISOString();
  const touched = new Set<string>();
  for (const c of candidates) {
    if (c.rejection_reason === "INSUFFICIENT_EVIDENCE") continue;
    for (const k of c.keys) {
      if (touched.has(k)) continue;
      touched.add(k);
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
  const cost = billedCost(usage, config.OBSERVER_SCAN_RESERVE_USD);
  if (cost > config.OBSERVER_ALERT_SCAN_USD) {
    alerts.push(`Coût du scan ${fmtUsd(cost)} au-dessus du seuil d'alerte (${fmtUsd(config.OBSERVER_ALERT_SCAN_USD)}).`);
  }
  if (costMismatch(usage)) {
    const ratio = usage.cost_usd_actual! / usage.cost_usd_estimated;
    alerts.push(
      `Écart réel/estimé ×${ratio.toFixed(2)} : le budget retient le plus élevé des deux. Vérifier l'unité de cost_in_usd_ticks et la grille PRICING (config.ts).`,
    );
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

/**
 * JSON du modèle, avec deux défenses si l'option no_inline_citations n'est pas respectée :
 * retrait des liens [[N]](url) insérés dans le texte, puis extraction du premier objet {...}
 * si une phrase précède la réponse. Renvoie undefined si rien n'est exploitable.
 */
export function parseModelJson(text: string): unknown {
  const attempts = [text, text.replace(/\s?\[\[\d+\]\]\([^)\s]*\)/g, "")];
  const last = attempts[1]!;
  const start = last.indexOf("{");
  const end = last.lastIndexOf("}");
  if (start >= 0 && end > start) attempts.push(last.slice(start, end + 1));
  for (const t of attempts) {
    try {
      return JSON.parse(t);
    } catch {
      // essai suivant
    }
  }
  return undefined;
}
