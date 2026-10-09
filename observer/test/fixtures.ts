/**
 * Réponses xAI SYNTHÉTIQUES, écrites à la main pour les tests unitaires.
 * Elles imitent la forme documentée de /v1/responses ; ce ne sont PAS des résultats de scan réels.
 */
import type { Config } from "../src/config";
import { loadConfig } from "../src/config";
import type { GrokCandidate, GrokScanOutput } from "../src/contract";
import type { LedgerEntry, SavedScan, SeenEntry, Store } from "../src/store";

export const NOW = new Date("2026-10-09T18:00:00Z");

export function snowflakeFor(date: Date, seq = 0): string {
  return (((BigInt(date.getTime()) - 1288834974657n) << 22n) + BigInt(seq)).toString();
}

export function candidate(overrides: Partial<GrokCandidate> = {}): GrokCandidate {
  const id = snowflakeFor(new Date("2026-10-08T12:00:00Z"));
  return {
    name: "Lantern Moss",
    type: "game",
    x_handle: "mossdev",
    evidence_post_url: `https://x.com/mossdev/status/${id}`,
    evidence_summary: "GIF de gameplay : une lanterne qui fait pousser la mousse pour créer des plateformes.",
    other_urls: ["https://store.steampowered.com/app/3123450/Lantern_Moss/"],
    declared_followers: 3400,
    declared_post_likes: 210,
    declared_post_views: null,
    why_interesting: "Mécanique de plateforme générée par la lumière, rendu peint à la main.",
    why_underexposed: "Démo soignée, 3 400 abonnés seulement.",
    why_now: "Page Steam ouverte hier.",
    risks: [],
    quality: 4,
    originality: 5,
    story: 4,
    facts: ["Page Steam ouverte le 2026-10-08"],
    inferences: ["Probablement développé seul"],
    ...overrides,
  };
}

export function scanOutput(candidates: GrokCandidate[], overrides: Partial<GrokScanOutput> = {}): GrokScanOutput {
  return {
    candidates,
    discarded: [{ name: "Big Studio Game", reason: "ALREADY_MAINSTREAM", note: "éditeur établi" }],
    posts_reviewed_estimate: 80,
    scan_notes: "Vivier correct.",
    ...overrides,
  };
}

export function xaiResponse(opts: {
  output: unknown;
  citations?: string[];
  annotations?: string[];
  usage?: Record<string, unknown> | null;
  toolItems?: unknown[];
  status?: string;
}): Record<string, unknown> {
  return {
    id: "resp_synthetic",
    object: "response",
    model: "grok-4.7",
    status: opts.status ?? "completed",
    output: [
      ...(opts.toolItems ?? [
        {
          type: "custom_tool_call",
          id: "ctc_1",
          name: "x_keyword_search",
          input: JSON.stringify({ query: "\"my first game\" filter:media" }),
          status: "completed",
        },
      ]),
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: typeof opts.output === "string" ? opts.output : JSON.stringify(opts.output),
            annotations: (opts.annotations ?? []).map((url) => ({ type: "url_citation", url })),
          },
        ],
      },
    ],
    citations: opts.citations ?? [],
    usage:
      opts.usage === null
        ? undefined
        : (opts.usage ?? {
            input_tokens: 60_000,
            input_tokens_details: { cached_tokens: 36_000 },
            output_tokens: 6_000,
            output_tokens_details: { reasoning_tokens: 2_000 },
            cost_in_usd_ticks: 7_200_000_000,
            server_side_tool_usage_details: { x_posts_fetched: 95, x_users_fetched: 4, x_search_calls: 4, web_search_calls: 0 },
          }),
  };
}

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ XAI_API_KEY: "test-key", OBSERVER_DATA_DIR: "unused", ...overrides });
}

export class MemoryStore implements Store {
  ledger: LedgerEntry[] = [];
  seen: Record<string, SeenEntry> = {};
  scans: SavedScan[] = [];
  locked = false;

  async readLedger() {
    return [...this.ledger];
  }
  async recordLedger(e: LedgerEntry) {
    this.ledger = this.ledger.filter((x) => x.scan_id !== e.scan_id);
    this.ledger.push(e);
  }
  async readSeen() {
    return { ...this.seen };
  }
  async writeSeen(s: Record<string, SeenEntry>) {
    this.seen = s;
  }
  async saveScan(s: SavedScan) {
    this.scans.push(s);
    return `memory://${s.report.scan_id}`;
  }
  async acquireLock() {
    if (this.locked) throw new Error("locked");
    this.locked = true;
    return async () => {
      this.locked = false;
    };
  }
}

export function fakeFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const impl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    const next = responses.shift();
    if (!next) throw new Error("fakeFetch: plus de réponse prévue");
    return new Response(typeof next.body === "string" ? next.body : JSON.stringify(next.body), {
      status: next.status,
      headers: next.headers,
    });
  };
  return { impl, calls };
}
