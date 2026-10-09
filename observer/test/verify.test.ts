import { describe, expect, it } from "vitest";
import {
  checkEvidence,
  citationKey,
  citationKeySet,
  citedXAuthors,
  normalizeHandle,
  parseXStatusUrl,
  snowflakeToDate,
} from "../src/verify";
import { candidate, snowflakeFor } from "./fixtures";

describe("normalizeHandle", () => {
  it("retire @, met en minuscules et rejette les handles invalides", () => {
    expect(normalizeHandle("@MossDev")).toBe("mossdev");
    expect(normalizeHandle(" moss_dev ")).toBe("moss_dev");
    expect(normalizeHandle("moss-dev")).toBeNull();
    expect(normalizeHandle("a".repeat(16))).toBeNull();
    expect(normalizeHandle(null)).toBeNull();
  });
});

describe("parseXStatusUrl", () => {
  it("accepte x.com, twitter.com, mobile et les suffixes", () => {
    expect(parseXStatusUrl("https://x.com/MossDev/status/1842")).toEqual({ handle: "mossdev", id: "1842" });
    expect(parseXStatusUrl("https://twitter.com/mossdev/status/1842?s=20&t=abc")).toEqual({ handle: "mossdev", id: "1842" });
    expect(parseXStatusUrl("https://mobile.twitter.com/mossdev/status/1842/photo/1")).toEqual({ handle: "mossdev", id: "1842" });
    expect(parseXStatusUrl("https://x.com/i/web/status/1842")).toEqual({ handle: null, id: "1842" });
  });

  it("refuse ce qui n'est pas un post X", () => {
    expect(parseXStatusUrl("https://x.com/mossdev")).toBeNull();
    expect(parseXStatusUrl("https://store.steampowered.com/app/1")).toBeNull();
    expect(parseXStatusUrl("https://x.com/mossdev/status/abc")).toBeNull();
    expect(parseXStatusUrl("pas une url")).toBeNull();
    expect(parseXStatusUrl("https://evilx.com/mossdev/status/1842")).toBeNull();
  });
});

describe("snowflakeToDate", () => {
  it("retrouve la date encodée dans l'identifiant", () => {
    const d = new Date("2026-10-08T12:00:00Z");
    expect(snowflakeToDate(snowflakeFor(d))?.toISOString()).toBe(d.toISOString());
  });

  it("rejette les identifiants antérieurs aux snowflakes ou dans le futur", () => {
    expect(snowflakeToDate("20")).toBeNull();
    expect(snowflakeToDate(snowflakeFor(new Date(Date.now() + 10 * 86_400_000)))).toBeNull();
  });
});

describe("citationKey", () => {
  it("compare les posts X par identifiant, quel que soit le domaine ou les paramètres", () => {
    expect(citationKey("https://twitter.com/A/status/99?s=1")).toBe("x:status:99");
    expect(citationKey("https://x.com/a/status/99")).toBe("x:status:99");
    expect(citationKey("https://www.example.com/page/")).toBe("url:example.com/page");
  });
});

describe("checkEvidence", () => {
  const windowStart = new Date("2026-10-07T00:00:00Z");

  it("valide une preuve citée et dans la fenêtre", () => {
    const c = candidate();
    const ev = checkEvidence(c, { citationKeys: citationKeySet([c.evidence_post_url]), windowStart });
    expect(ev.cited).toBe(true);
    expect(ev.posted_at).toBe("2026-10-08T12:00:00.000Z");
    expect(ev.flags).toEqual(["METRICS_DECLARED_BY_MODEL"]);
  });

  it("signale une URL absente des citations (hallucination possible)", () => {
    const ev = checkEvidence(candidate(), { citationKeys: new Set(), windowStart });
    expect(ev.cited).toBe(false);
    expect(ev.flags).toContain("EVIDENCE_NOT_CITED");
  });

  it("signale une preuve qui n'est pas un post X", () => {
    const ev = checkEvidence(candidate({ evidence_post_url: "https://mossdev.itch.io/lantern" }), {
      citationKeys: new Set(),
      windowStart,
    });
    expect(ev.flags).toContain("EVIDENCE_NOT_X_POST");
  });

  it("signale un post hors fenêtre et un auteur différent du créateur", () => {
    const old = snowflakeFor(new Date("2026-09-01T00:00:00Z"));
    const c = candidate({ evidence_post_url: `https://x.com/fanaccount/status/${old}` });
    const ev = checkEvidence(c, { citationKeys: citationKeySet([c.evidence_post_url]), windowStart });
    expect(ev.flags).toEqual(expect.arrayContaining(["OUTSIDE_WINDOW", "HANDLE_MISMATCH"]));
  });

  it("prend l'auteur dans la citation xAI quand elle porte un handle", () => {
    const c = candidate();
    const id = parseXStatusUrl(c.evidence_post_url)!.id;
    const citations = [`https://x.com/RandomFan/status/${id}`];
    const ev = checkEvidence(c, { citationKeys: citationKeySet(citations), citedAuthors: citedXAuthors(citations), windowStart });
    expect(ev).toMatchObject({ cited: true, author_handle: "randomfan" });
    expect(ev.flags).toContain("HANDLE_MISMATCH");
  });

  it("une citation sans handle (x.com/i/status/<id>) ne change pas l'auteur", () => {
    const c = candidate();
    const id = parseXStatusUrl(c.evidence_post_url)!.id;
    const citations = [`https://x.com/i/status/${id}`];
    const ev = checkEvidence(c, { citationKeys: citationKeySet(citations), citedAuthors: citedXAuthors(citations), windowStart });
    expect(ev).toMatchObject({ cited: true, author_handle: "mossdev" });
    expect(ev.flags).not.toContain("HANDLE_MISMATCH");
  });
});
