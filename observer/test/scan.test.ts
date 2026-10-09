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

    // La réserve posée avant l'appel est remplacée par le coût réel.
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

  it("réessaie une seule fois sur 429 (puis abandonne sans rien facturer), jamais sur 5xx", async () => {
    const raw = xaiResponse({ output: scanOutput([]) });
    const store = new MemoryStore();
    const ok = deps(store, [
      { status: 429, body: "slow down", headers: { "retry-after": "1" } },
      { status: 200, body: raw },
    ]);
    expect((await runLiveScan(OPTS, ok.deps)).report.status).toBe("succeeded");
    expect(ok.f.calls).toHaveLength(2);

    const store429 = new MemoryStore();
    const twice = deps(store429, [
      { status: 429, body: "slow down" },
      { status: 429, body: "slow down" },
    ]);
    expect((await runLiveScan(OPTS, twice.deps)).report.error?.code).toBe("HTTP_ERROR");
    expect(twice.f.calls).toHaveLength(2);
    expect(store429.ledger).toEqual([expect.objectContaining({ cost_usd: 0, source: "released" })]);

    // 5xx : peut-être facturé → pas de nouvel essai, la réserve reste comptée dans le budget.
    const store2 = new MemoryStore();
    const ko = deps(store2, [{ status: 503, body: "oops" }]);
    const { report } = await runLiveScan(OPTS, ko.deps);
    expect(report).toMatchObject({ status: "failed", error: { code: "HTTP_ERROR" } });
    expect(report.alerts.join(" ")).toMatch(/console xAI/);
    expect(ko.f.calls).toHaveLength(1);
    expect(store2.ledger).toEqual([expect.objectContaining({ cost_usd: 2, source: "reserved" })]);
  });

  it("un 200 au corps illisible est compté comme facturé", async () => {
    const store = new MemoryStore();
    const { report } = await runLiveScan(OPTS, deps(store, [{ status: 200, body: "<html>gateway</html>" }]).deps);
    expect(report.error?.code).toBe("BAD_JSON");
    expect(store.ledger).toEqual([expect.objectContaining({ cost_usd: 2, source: "reserved" })]);
  });

  it("le coût est inscrit avant le traitement : une panne ensuite ne le perd pas", async () => {
    class BrokenSeen extends MemoryStore {
      override async readSeen(): Promise<never> {
        throw new Error("seen.json illisible");
      }
    }
    const store = new BrokenSeen();
    const raw = xaiResponse({ output: scanOutput([]) });
    await expect(runLiveScan(OPTS, deps(store, [{ status: 200, body: raw }]).deps)).rejects.toThrow(/illisible/);
    expect(store.ledger).toEqual([expect.objectContaining({ cost_usd: 0.72, source: "actual" })]);
    expect(store.locked).toBe(false);
  });

  it("le budget compte les réserves des scans en échec", async () => {
    const store = new MemoryStore();
    store.ledger.push({ scan_id: "a", at: NOW.toISOString(), cost_usd: 2, source: "reserved" });
    store.ledger.push({ scan_id: "b", at: NOW.toISOString(), cost_usd: 1.5, source: "reserved" });
    await expect(runLiveScan(OPTS, deps(store, []).deps)).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("supporte les citations insérées dans le texte si xAI ignore no_inline_citations", async () => {
    const c = candidate();
    const json = JSON.stringify(scanOutput([c]));
    const polluted = json.replace('"scan_notes"', ' [[1]](https://x.com/i/status/1) "scan_notes"');
    const raw = xaiResponse({ output: `Voici le résultat : ${polluted}`, annotations: [c.evidence_post_url] });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    expect(report.status).toBe("succeeded");
    expect(report.candidates[0]?.decision).toBe("SHORTLIST");
  });

  it("un candidat hors contrat est écarté avec une alerte, les autres sont gardés", async () => {
    const good = candidate();
    const raw = xaiResponse({
      output: scanOutput([good, candidate({ name: "Bad", story: 9 })]),
      citations: [good.evidence_post_url],
    });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    expect(report.status).toBe("succeeded");
    expect(report.candidates.map((x) => x.source.name)).toEqual(["Lantern Moss"]);
    expect(report.alerts.join(" ")).toMatch(/hors contrat/);
  });

  it("sans x_handle, l'auteur du post (un curateur) ne devient pas l'identité du créateur", async () => {
    const id = snowflakeFor(new Date("2026-10-08T09:00:00Z"));
    const c = candidate({ x_handle: null, evidence_post_url: `https://x.com/curator/status/${id}`, other_urls: [] });
    const raw = xaiResponse({ output: scanOutput([c]), citations: [c.evidence_post_url] });
    const store = new MemoryStore();
    const { report } = await runLiveScan(OPTS, deps(store, [{ status: 200, body: raw }]).deps);
    expect(report.candidates[0]).toMatchObject({ handle: null, keys: [] });
    expect(report.candidates[0]!.evidence.author_handle).toBe("curator");
    expect(store.seen["x:curator"]).toBeUndefined();
  });

  it("l'auteur réel vient de la citation xAI, pas de l'URL écrite par le modèle", async () => {
    const id = snowflakeFor(new Date("2026-10-08T09:00:00Z"));
    const c = candidate({ evidence_post_url: `https://x.com/mossdev/status/${id}` });
    const raw = xaiResponse({ output: scanOutput([c]), citations: [`https://x.com/randomfan/status/${id}`] });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    expect(report.candidates[0]!.evidence).toMatchObject({ cited: true, author_handle: "randomfan" });
    expect(report.candidates[0]!.flags).toContain("HANDLE_MISMATCH");
  });

  it("un doublon vérifié l'emporte sur un doublon non vérifié mieux noté", async () => {
    const verified = candidate({ name: "Vérifié", quality: 4, originality: 4 });
    const unverified = candidate({
      name: "Non vérifié",
      quality: 5,
      originality: 5,
      evidence_post_url: `https://x.com/mossdev/status/${snowflakeFor(new Date("2026-10-08T20:00:00Z"))}`,
    });
    const raw = xaiResponse({ output: scanOutput([unverified, verified]), citations: [verified.evidence_post_url] });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    const byName = Object.fromEntries(report.candidates.map((x) => [x.source.name, x]));
    expect(byName["Vérifié"]!.decision).toBe("SHORTLIST");
    expect(byName["Non vérifié"]).toMatchObject({ decision: "REJECT", rejection_reason: "INSUFFICIENT_EVIDENCE" });
    expect(byName["Non vérifié"]!.flags).toContain("DUPLICATE_IN_SCAN");
  });

  it("alerte sur un thread récupéré ou un appel de fonction inattendu", async () => {
    const raw = xaiResponse({
      output: scanOutput([]),
      toolItems: [
        { type: "custom_tool_call", id: "t1", name: "x_thread_fetch", input: "{}", status: "completed" },
        { type: "function_call", id: "f1", call_id: "c1", name: "save_candidate", arguments: "{}" },
      ],
    });
    const { report } = await runLiveScan(OPTS, deps(new MemoryStore(), [{ status: 200, body: raw }]).deps);
    expect(report.alerts.join("\n")).toMatch(/thread complet/);
    expect(report.alerts.join("\n")).toMatch(/fonction client inattendu/);
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

describe("historique (seen)", () => {
  it("une clé compte une fois par scan, avec la meilleure décision ; le scan suivant la voit « déjà vue »", async () => {
    const good = candidate();
    const dupe = candidate({
      name: "Lantern Moss (démo)",
      evidence_post_url: `https://x.com/mossdev/status/${snowflakeFor(new Date("2026-10-08T15:00:00Z"))}`,
      quality: 3,
    });
    const raw = xaiResponse({ output: scanOutput([good, dupe]), citations: [good.evidence_post_url, dupe.evidence_post_url] });
    const store = new MemoryStore();
    await runLiveScan(OPTS, deps(store, [{ status: 200, body: raw }]).deps);
    expect(store.seen["x:mossdev"]).toMatchObject({ times_seen: 1, last_decision: "SHORTLIST" });

    const later = new Date("2026-10-10T18:00:00Z");
    const f = fakeFetch([{ status: 200, body: raw }]);
    const { report } = await runLiveScan(OPTS, { config: testConfig(), store, fetchImpl: f.impl, now: () => later });
    const first = report.candidates.find((x) => x.source.name === "Lantern Moss")!;
    expect(first.flags).toContain("SEEN_BEFORE");
    expect(first.seen_before).toEqual({ first_seen_at: NOW.toISOString(), times_seen: 1 });
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

    const seenBefore = await store.readSeen();
    const replay = await replayScan(saved, OPTS, { config: testConfig(), store, fetchImpl: fakeFetch([]).impl, now: () => NOW });
    expect(replay.report.mode).toBe("replay");
    expect(replay.report.candidates.map((x) => x.decision)).toEqual(["SHORTLIST"]);
    // Le rejeu ne se voit pas « déjà vu » par le scan qu'il rejoue, et ne touche ni au budget ni à l'historique.
    expect(replay.report.candidates[0]!.seen_before).toBeNull();
    expect(replay.report.candidates[0]!.flags).not.toContain("SEEN_BEFORE");
    expect(await store.readLedger()).toHaveLength(1);
    expect(await store.readSeen()).toEqual(seenBefore);
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

  it("un verrou périmé est repris, et l'ancien propriétaire ne peut plus supprimer le nouveau", async () => {
    dir = await mkdtemp(join(tmpdir(), "observer-test-"));
    const store = new FileStore(dir);
    const releaseA = await store.acquireLock(60_000);
    await new Promise((r) => setTimeout(r, 20));
    const releaseB = await store.acquireLock(1); // A est considéré comme périmé
    await releaseA(); // ne doit pas supprimer le verrou de B
    await expect(store.acquireLock(60_000)).rejects.toBeInstanceOf(ScanLockedError);
    await releaseB();
  });

  it("runLiveScan refuse un second scan pendant qu'un premier tient le verrou", async () => {
    dir = await mkdtemp(join(tmpdir(), "observer-test-"));
    const store = new FileStore(dir);
    const release = await store.acquireLock(60_000);
    const f = fakeFetch([]);
    await expect(runLiveScan(OPTS, { config: testConfig(), store, fetchImpl: f.impl, now: () => NOW })).rejects.toBeInstanceOf(
      ScanLockedError,
    );
    expect(f.calls).toHaveLength(0);
    await release();
  });
});
