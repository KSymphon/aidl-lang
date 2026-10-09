import type { GrokCandidate, VerificationFlag } from "./contract";

/**
 * Vérifications déterministes, faites par le code et non par le modèle :
 * l'URL de preuve doit être un post X présent dans les citations de la réponse, sinon le candidat est
 * considéré comme non prouvé (possible hallucination). Les chiffres restent « déclarés par le modèle ».
 */

const TWITTER_EPOCH_MS = 1288834974657n;
const HANDLE_RE = /^[a-z0-9_]{1,15}$/;
const X_HOSTS = new Set(["x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com", "www.x.com", "www.twitter.com"]);
const RESERVED_PATHS = new Set(["i", "home", "search", "explore", "intent", "share", "hashtag", "settings"]);

export function normalizeHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  const v = h.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_RE.test(v) ? v : null;
}

export interface XStatusRef {
  handle: string | null;
  id: string;
}

export function parseXStatusUrl(url: string): XStatusRef | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!X_HOSTS.has(u.hostname.toLowerCase())) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // /<handle>/status/<id> ou /i/web/status/<id>
  const statusIdx = parts.findIndex((p) => p === "status" || p === "statuses");
  if (statusIdx < 1) return null;
  const id = parts[statusIdx + 1];
  if (!id || !/^\d{1,20}$/.test(id)) return null;
  const owner = parts[0]!.toLowerCase();
  const handle = statusIdx === 1 && !RESERVED_PATHS.has(owner) ? normalizeHandle(owner) : null;
  return { handle, id };
}

/** Date de publication encodée dans un identifiant snowflake de post X. */
export function snowflakeToDate(id: string): Date | null {
  try {
    const offset = BigInt(id) >> 22n;
    // Les anciens identifiants séquentiels (avant novembre 2010) donnent un décalage de quelques secondes.
    if (offset < 86_400_000n) return null;
    const ms = Number(offset + TWITTER_EPOCH_MS);
    // Au-delà de demain, l'identifiant est incohérent.
    if (ms > Date.now() + 86_400_000) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

/** Clé de comparaison d'une URL citée : identifiant de post pour X, URL normalisée sinon. */
export function citationKey(url: string): string | null {
  const x = parseXStatusUrl(url);
  if (x) return `x:status:${x.id}`;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `url:${host}${path}`;
  } catch {
    return null;
  }
}

export function citationKeySet(citations: string[]): Set<string> {
  const keys = new Set<string>();
  for (const c of citations) {
    const k = citationKey(c);
    if (k) keys.add(k);
  }
  return keys;
}

/** Auteur de chaque post cité, d'après l'URL fournie par xAI (pas celle écrite par le modèle). */
export function citedXAuthors(citations: string[]): Map<string, string> {
  const authors = new Map<string, string>();
  for (const c of citations) {
    const ref = parseXStatusUrl(c);
    if (ref?.handle) authors.set(ref.id, ref.handle);
  }
  return authors;
}

export interface EvidenceCheck {
  canonical_url: string | null;
  author_handle: string | null;
  post_id: string | null;
  posted_at: string | null;
  cited: boolean;
  flags: VerificationFlag[];
}

export function checkEvidence(
  c: GrokCandidate,
  ctx: { citationKeys: Set<string>; citedAuthors?: Map<string, string>; windowStart: Date },
): EvidenceCheck {
  const flags: VerificationFlag[] = [];
  const ref = parseXStatusUrl(c.evidence_post_url);
  const handle = normalizeHandle(c.x_handle);
  if (!handle) flags.push("NO_HANDLE");

  if (!ref) {
    flags.push("EVIDENCE_NOT_X_POST");
    return { canonical_url: null, author_handle: null, post_id: null, posted_at: null, cited: false, flags };
  }

  const cited = ctx.citationKeys.has(`x:status:${ref.id}`);
  if (!cited) flags.push("EVIDENCE_NOT_CITED");

  const posted = snowflakeToDate(ref.id);
  if (!posted) {
    flags.push("EVIDENCE_NOT_X_POST");
  } else if (posted.getTime() < ctx.windowStart.getTime()) {
    flags.push("OUTSIDE_WINDOW");
  }

  // L'auteur fait foi d'après la citation xAI quand elle porte un handle (les citations sont souvent en
  // x.com/i/status/<id>, sans handle). Un post de tiers qui partage le projet est signalé, pas bloquant.
  const citedAuthor = ctx.citedAuthors?.get(ref.id) ?? null;
  const author = citedAuthor ?? ref.handle;
  if ((citedAuthor && ref.handle && citedAuthor !== ref.handle) || (handle && author && handle !== author)) {
    flags.push("HANDLE_MISMATCH");
  }

  if (c.declared_followers !== null || c.declared_post_likes !== null || c.declared_post_views !== null) {
    flags.push("METRICS_DECLARED_BY_MODEL");
  }

  return {
    canonical_url: author ? `https://x.com/${author}/status/${ref.id}` : `https://x.com/i/web/status/${ref.id}`,
    author_handle: author,
    post_id: ref.id,
    posted_at: posted ? posted.toISOString() : null,
    cited,
    flags,
  };
}
