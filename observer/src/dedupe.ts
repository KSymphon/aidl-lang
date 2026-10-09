import { normalizeHandle } from "./verify";

/**
 * Identité d'un candidat = ensemble de clés normalisées. Deux candidats qui partagent une clé
 * (même handle, même page Steam, même page itch.io, même domaine) sont le même sujet.
 */

const PLATFORM_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "t.co",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "linktr.ee",
  "discord.gg",
  "discord.com",
  "reddit.com",
  "bsky.app",
  "twitch.tv",
  "store.steampowered.com",
  "steamcommunity.com",
  "itch.io",
  "github.com",
  "kickstarter.com",
  "play.google.com",
  "apps.apple.com",
  // Hôtes partagés : une page dessus n'identifie pas un projet à elle seule.
  "s.team",
  "store.epicgames.com",
  "epicgames.com",
  "gog.com",
  "gamejolt.com",
  "newgrounds.com",
  "indiedb.com",
  "google.com",
  "patreon.com",
  "ko-fi.com",
  "facebook.com",
  "threads.net",
  "bit.ly",
  "indiegogo.com",
  "carrd.co",
  "notion.site",
  "medium.com",
  "substack.com",
]);

function isPlatform(host: string): boolean {
  for (const p of PLATFORM_HOSTS) if (host === p || host.endsWith(`.${p}`)) return true;
  return false;
}

export function keysFor(input: { x_handle: string | null; urls: string[] }): string[] {
  const keys = new Set<string>();
  const h = normalizeHandle(input.x_handle);
  if (h) keys.add(`x:${h}`);
  for (const raw of input.urls) {
    const k = urlKey(raw);
    if (k) keys.add(k);
  }
  return [...keys];
}

export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "store.steampowered.com" && parts[0] === "app" && parts[1] && /^\d+$/.test(parts[1])) {
    return `steam:${parts[1]}`;
  }
  if (host === "s.team" && parts[0] === "a" && parts[1] && /^\d+$/.test(parts[1])) {
    return `steam:${parts[1]}`;
  }
  if (host.endsWith(".itch.io") && host !== "itch.io") {
    const user = host.slice(0, -".itch.io".length);
    return parts[0] ? `itch:${user}/${parts[0].toLowerCase()}` : `itch:${user}`;
  }
  if (host === "github.com" && parts.length >= 2) {
    return `github:${parts[0]!.toLowerCase()}/${parts[1]!.toLowerCase()}`;
  }
  if (host === "apps.apple.com") {
    const id = parts.find((p) => /^id\d+$/.test(p));
    return id ? `appstore:${id.slice(2)}` : null;
  }
  if (host === "play.google.com") {
    const id = u.searchParams.get("id");
    return id ? `playstore:${id.toLowerCase()}` : null;
  }
  // Dans le doute, pas de clé : une fusion à tort coûte plus cher qu'une fusion manquée.
  if (isPlatform(host)) return null;
  return `domain:${host}`;
}

/**
 * Regroupe les candidats d'un scan qui partagent une clé (union-find).
 * Renvoie, pour chaque index, l'index du représentant de son groupe (le mieux classé).
 */
export function groupDuplicates(keysByIndex: string[][], priorityByIndex: number[]): number[] {
  const parent = keysByIndex.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const owner = new Map<string, number>();
  keysByIndex.forEach((keys, i) => {
    for (const k of keys) {
      const j = owner.get(k);
      if (j === undefined) owner.set(k, i);
      else parent[find(i)] = find(j);
    }
  });
  const best = new Map<number, number>();
  keysByIndex.forEach((_, i) => {
    const root = find(i);
    const cur = best.get(root);
    if (cur === undefined || priorityByIndex[i]! > priorityByIndex[cur]!) best.set(root, i);
  });
  return keysByIndex.map((_, i) => best.get(find(i))!);
}
