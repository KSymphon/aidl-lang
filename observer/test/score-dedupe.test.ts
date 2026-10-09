import { describe, expect, it } from "vitest";
import { groupDuplicates, keysFor, urlKey } from "../src/dedupe";
import { exposureBucket, priorityOf, suggestDecision } from "../src/score";
import { INDIE_GAMES } from "../src/verticals";
import { candidate } from "./fixtures";

const T = INDIE_GAMES.exposure;

describe("exposureBucket", () => {
  it("classe par tranches d'abonnés propres à la verticale", () => {
    expect(exposureBucket(null, T)).toBe("unknown");
    expect(exposureBucket(500, T)).toBe("nano");
    expect(exposureBucket(6_800, T)).toBe("micro");
    expect(exposureBucket(30_000, T)).toBe("small");
    expect(exposureBucket(120_000, T)).toBe("mid");
    expect(exposureBucket(2_000_000, T)).toBe("large");
  });
});

describe("priorité et décision", () => {
  it("une pépite sous-exposée passe devant un sujet excellent mais déjà exposé", () => {
    // Contre-exemple de la somme pondérée du §19 (75 vs 72 en faveur du mainstream).
    const mainstream = candidate({ quality: 5, originality: 5, story: 5, declared_followers: 900_000 });
    const gem = candidate({ quality: 4, originality: 5, story: 4, declared_followers: 3_400 });
    expect(suggestDecision(mainstream, exposureBucket(900_000, T), []).decision).toBe("REJECT");
    expect(suggestDecision(mainstream, "large", []).reason).toBe("ALREADY_MAINSTREAM");
    expect(suggestDecision(gem, exposureBucket(3_400, T), []).decision).toBe("SHORTLIST");
    expect(priorityOf(gem, "micro")).toBeGreaterThan(priorityOf(mainstream, "large"));
  });

  it("une preuve non vérifiée est toujours rejetée, quel que soit le mérite", () => {
    const d = suggestDecision(candidate({ quality: 5, originality: 5, story: 5 }), "nano", ["EVIDENCE_NOT_CITED"]);
    expect(d).toMatchObject({ decision: "REJECT", reason: "INSUFFICIENT_EVIDENCE" });
  });

  it("exposition inconnue ou moyenne : à surveiller plutôt que shortlist", () => {
    const c = candidate({ quality: 5, originality: 4, story: 4 });
    expect(suggestDecision(c, "unknown", []).decision).toBe("WATCH");
    expect(suggestDecision(c, "mid", []).decision).toBe("WATCH");
  });

  it("mérite faible : rejet avec la raison la plus juste", () => {
    expect(suggestDecision(candidate({ quality: 2, originality: 2 }), "micro", []).reason).toBe("NOT_ORIGINAL");
    expect(suggestDecision(candidate({ quality: 2, originality: 3 }), "micro", []).reason).toBe("LOW_QUALITY");
  });

  it("bon mérite sans histoire : à surveiller", () => {
    expect(suggestDecision(candidate({ quality: 4, originality: 4, story: 2 }), "micro", []).decision).toBe("WATCH");
  });
});

describe("dédoublonnage", () => {
  it("dérive des clés stables depuis les URLs connues", () => {
    expect(urlKey("https://store.steampowered.com/app/3123450/Lantern_Moss/")).toBe("steam:3123450");
    expect(urlKey("https://MossDev.itch.io/Lantern-Moss")).toBe("itch:mossdev/lantern-moss");
    expect(urlKey("https://github.com/Moss/Lantern")).toBe("github:moss/lantern");
    expect(urlKey("https://www.lanternmoss.com/press")).toBe("domain:lanternmoss.com");
    expect(urlKey("https://youtube.com/watch?v=1")).toBeNull();
    expect(urlKey("https://x.com/mossdev")).toBeNull();
    expect(keysFor({ x_handle: "@MossDev", urls: ["https://store.steampowered.com/app/1/"] })).toEqual([
      "x:mossdev",
      "steam:1",
    ]);
  });

  it("regroupe par clé partagée, y compris transitivement, et garde le mieux classé", () => {
    const keys = [["x:a", "steam:1"], ["steam:1"], ["x:b"], ["steam:1", "domain:c.com"], ["domain:c.com"]];
    const reps = groupDuplicates(keys, [50, 80, 70, 10, 90]);
    expect(reps).toEqual([4, 4, 2, 4, 4]);
  });
});
