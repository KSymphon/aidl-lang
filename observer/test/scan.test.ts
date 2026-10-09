import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BudgetExceededError } from "../src/budget";
import { replayScan, runLiveScan } from "../src/scan";
import { FileStore, ScanLockedError } from "../src/store";
import { MemoryStore, NOW, candidate, fakeFetch, scanOutput, snowflakeFor, testConfig, xaiResponse } from "./fixtures";

const OPTS = { type: "evening" as const, vertical: "indie-games" };
const noSleep = async () => {};

function deps(store: MemoryStore, responses: Parameters<typeof fakeFetch>[0], env: Record<string, string> = {}) {
  const f = fakeFetch(responses);
  return { f, deps: { config: testConfig(env), store, fetchImpl: f.impl, now: () => NOW, sleep: noSleep } };
}

describe("scan réel (fetch simulé avec des réponses synthétiques)", () => {
  it("rejette le candidat halluciné, fusionne le doublon, enregistre le coût et l'historique", async () => {
    const good = candidate();
    const dupe = candidate({
      name: "Lantern Moss (démo)",
      x_handle: "mossdev",
      evidence_post_url: `https://x.com/mossdev/status/${snowflakeFor(new Date("2026-10-08T15:00:00Z"))}`,
      quality: 3,
      originality: 4,
    });
    const ghost = candidate({
      name: "Ghost Game",
      x_handle: "ghostdev",
      evidence_post_url: `https://x.com/ghostdev/status/${snowflakeFor(new Date("2026-10-08T10:00:00Z"))}`,
      other_urls: [],
    });
    const raw = xaiResponse({
      output: scanOutput([ghost, dupe, good]),
      citations: [good.evidence_post_url, dupe.evidence_post_url],
    });
    const store = new MemoryStore();
    const { f, deps: d } = deps(store, [{ status: 200, body: raw }]);

    const { report } = await runLiveScan(OPTS, d);

    expect(report.status).toBe("succeeded");
    expect(f.calls[0]!.url).toBe("https://api.x.ai/v1/responses");
    const byName = Object.fromEntries(report.candidates.map((c) => [c.source.name, c]));
    expect(byName["Lantern Moss"]).toMatchObject({ decision: "SHORTLIST", rejection_reason: null });
    expect(byName["Lantern Moss (démo)"]).toMatchObject({ decision: "REJECT", rejection_reason: "DUPLICATE" });
    expect(byName["Ghost Game"]).toMatchObject({ decision: "REJECT", rejection_reason: "INSUFFICIENT_EVIDENCE" });
    expect(byName["Ghost Game"]!.flags).toContain("EVIDENCE_NOT_CITED");
    expect(report.candidates[0]!.source.name).toBe("Lantern Moss");
    expect(report.counts).toEqual({ returned: 3, shortlist: 1, watch: 0, reject: 2 });

    expect(store.ledger).toEqual([
      { scan_id: report.scan_id, at: NOW.toISOString(), cost_usd: 0.72, source: "actual" },
    ]);
    expect(Object.keys(store.seen).sort()).toEqual(["steam:3123450", "x:mossdev"]);
    expect(store.seen["x:ghostdev"]).toBeUndefined();
    expect(store.scans[0]!.response_raw).toEqual(raw);
    expect(store.locked).toBe(false);
  });

  it("rejette tout si aucune recherche X n'a eu lieu", async () => {
    const c = candidate();
    const raw = xaiResponse({
      output: scanOutput([c]),
      citations: [c.evidence_post_url],
      toolItems: [],
      usage: { input_tokens: 1000, output_tokens: 100, server_side_tool_usage_details: { x_posts_fetched: 0, x_search_calls: 0 } },
    });
    const store = new MemoryStore();
    const { report } = await runLiveScan(OPTS, deps(store, [{ status: 200, body: raw }]).deps);
    expect(report.candidates[0]).toMatchObject({ decision: "REJECT", rejection_reason: "INSUFFICIENT_EVIDENCE" });
    expect(report.candidates[0]!.flags).toContain("NO_SEARCH_PERFORMED");
    expect(report.alerts.join(" ")).toMatch(/hallucination/);
  });

  it("refuse de lancer un scan quand le budget du jour est atteint, sans appeler xAI", async () => {
    const store = new MemoryStore();
    store.ledger.push({ scan_id: "s0", at: NOW.toISOString(), cost_usd: 3.5, source: "actual" });
    const { f, deps: d } = deps(store, []);
    await expect(runLiveScan(OPTS, d)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(f.calls).toHaveLength(0);
    expect(store.locked).toBe(false);
  });

  it("sortie hors contrat : scan en échec mais coût quand même enregistré", async () => {
    const raw = xaiResponse({ output: "pas du json" });
    const store = new MemoryStore();
    const { report } = await runLiveScan(OPTS, deps(store, [{ status: 200, body: raw }]).deps);
    expect(report).toMatchObject({ status: "failed", error: { code: "INVALID_JSON" } });
    expect(store.ledger).toHaveLength(1);
  });

  it("réessaie une seule fois sur 429, jamais sur 5xx", async () => {
    const raw = xaiResponse({ output: scanOutput([]) });
    const store = new MemoryStore();
    const ok = deps(store, [
      { status: 429, body: "slow down", headers: { "retry-after": "1" } },
      { status: 200, body: raw },
    ]);
    expect((await runLiveScan(OPTS, ok.deps)).report.status).toBe("succeeded");
    expect(ok.f.calls).toHaveLength(2);

    const store2 = new MemoryStore();
    const ko = deps(store2, [{ status: 503, body: "oops" }]);
    const { report } = await runLiveScan(OPTS, ko.deps);
    expect(report).toMatchObject({ status: "failed", error: { code: "HTTP_ERROR" } });
    expect(report.alerts.join(" ")).toMatch(/console xAI/);
    expect(ko.f.calls).toHaveLength(1);
    expect(store2.ledger).toHaveLength(0);
  });

  it("alerte quand le scan dépasse les seuils de posts ou de coût", async () => {
    const raw = xaiResponse({
      output: scanOutput([]),
      usage: {
        input_tokens: 10_000,
        output_tokens: 1_000,
        cost_in_usd_ticks: 25_000_000_000,
        server_side_tool_usage_details: { x_posts_fetched: 400, x_users_fetched: 0, x_search_calls: 6, web_search_calls: 0 },
      },
    });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    expect(report.alerts.join("\n")).toMatch(/400 posts facturés/);
    expect(report.alerts.join("\n")).toMatch(/au-dessus du seuil/);
  });

  it("zéro candidat est un résultat normal", async () => {
    const raw = xaiResponse({ output: scanOutput([], { discarded: [] }) });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    expect(report).toMatchObject({ status: "succeeded", counts: { returned: 0, shortlist: 0, watch: 0, reject: 0 } });
  });
});

describe("rejeu et stockage fichier", () => {
  let dir: string | null = null;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("rejoue une réponse sauvegardée sans appel ni dépense, avec la même décision", async () => {
    dir = await mkdtemp(join(tmpdir(), "observer-test-"));
    const store = new FileStore(dir);
    const c = candidate();
    const raw = xaiResponse({ output: scanOutput([c]), citations: [c.evidence_post_url] });
    const live = await runLiveScan(OPTS, {
      config: testConfig(),
      store,
      fetchImpl: fakeFetch([{ status: 200, body: raw }]).impl,
      now: () => NOW,
    });
    const saved: unknown = JSON.parse(await readFile(live.file, "utf8"));

    const replay = await replayScan(saved, OPTS, { config: testConfig(), store, fetchImpl: fakeFetch([]).impl, now: () => NOW });
    expect(replay.report.mode).toBe("replay");
    expect(replay.report.candidates.map((x) => x.decision)).toEqual(["SHORTLIST"]);
    expect(await store.readLedger()).toHaveLength(1);
  });

  it("un seul scan à la fois", async () => {
    dir = await mkdtemp(join(tmpdir(), "observer-test-"));
    const store = new FileStore(dir);
    const release = await store.acquireLock(60_000);
    await expect(store.acquireLock(60_000)).rejects.toBeInstanceOf(ScanLockedError);
    await release();
    const again = await store.acquireLock(60_000);
    await again();
  });
});
