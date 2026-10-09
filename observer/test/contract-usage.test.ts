import { describe, expect, it } from "vitest";
import {
  GROK_OUTPUT_JSON_SCHEMA,
  GrokCandidateSchema,
  GrokDiscardSchema,
  GrokScanOutputSchema,
  parseGrokOutput,
} from "../src/contract";
import { extractResponse, toolQuery } from "../src/extract";
import { billedCost, costMismatch, parseUsage } from "../src/usage";
import { buildRequestBody } from "../src/xai-client";
import { candidate, scanOutput, testConfig, xaiResponse } from "./fixtures";

describe("contrat JSON Schema ↔ zod", () => {
  const sameKeys = (schemaProps: object, zodShape: object, required: readonly string[]) => {
    expect(Object.keys(schemaProps).sort()).toEqual(Object.keys(zodShape).sort());
    expect([...required].sort()).toEqual(Object.keys(zodShape).sort());
  };

  it("mêmes champs, tous requis (mode strict)", () => {
    const root = GROK_OUTPUT_JSON_SCHEMA;
    sameKeys(root.properties, GrokScanOutputSchema.shape, root.required);
    const item = root.properties.candidates.items;
    sameKeys(item.properties, GrokCandidateSchema.shape, item.required);
    const disc = root.properties.discarded.items;
    sameKeys(disc.properties, GrokDiscardSchema.shape, disc.required);
  });

  it("valide une sortie conforme et refuse une note hors grille", () => {
    expect(GrokScanOutputSchema.safeParse(scanOutput([candidate()])).success).toBe(true);
    expect(GrokScanOutputSchema.safeParse(scanOutput([candidate({ quality: 7 })])).success).toBe(false);
  });

  it("contraint les notes et la taille des listes dans le schéma envoyé", () => {
    const item = GROK_OUTPUT_JSON_SCHEMA.properties.candidates.items.properties;
    expect(item.story.enum).toEqual([1, 2, 3, 4, 5]);
    expect(GROK_OUTPUT_JSON_SCHEMA.properties.candidates.maxItems).toBe(5);
    expect(GROK_OUTPUT_JSON_SCHEMA.properties.discarded.maxItems).toBe(10);
  });

  it("un candidat hors contrat est écarté sans faire perdre les autres", () => {
    const r = parseGrokOutput(scanOutput([candidate({ name: "bon" }), candidate({ name: "mauvais", story: 0 })]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output.candidates.map((c) => c.name)).toEqual(["bon"]);
    expect(r.dropped).toHaveLength(1);
    expect(r.dropped[0]).toMatch(/candidat 1/);
  });

  it("au-delà de 5 candidats, le surplus est ignoré et signalé", () => {
    const many = Array.from({ length: 7 }, (_, i) => candidate({ name: `c${i}` }));
    const r = parseGrokOutput(scanOutput(many));
    expect(r.ok && r.output.candidates.length).toBe(5);
    expect(r.ok && r.dropped.join()).toMatch(/2 candidat/);
  });

  it("une enveloppe invalide fait échouer le parsing", () => {
    expect(parseGrokOutput({ candidates: [] }).ok).toBe(false);
  });
});

describe("requête xAI", () => {
  it("n'expose que x_search, aucune fonction, et borne les tours", () => {
    const body = buildRequestBody(testConfig(), { system: "s", user: "u" }, {
      from_date: "2026-10-08",
      to_date: "2026-10-09",
      excluded_x_handles: Array.from({ length: 25 }, (_, i) => `h${i}`),
    });
    const tools = body.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ type: "x_search", from_date: "2026-10-08", to_date: "2026-10-09" });
    expect((tools[0]!.excluded_x_handles as string[]).length).toBe(20);
    expect(body.max_turns).toBe(3);
    expect(body.store).toBe(false);
    expect(body).not.toHaveProperty("search_parameters");
    expect(body.text).toMatchObject({ format: { type: "json_schema", strict: true } });
    expect(body.include).toEqual(["no_inline_citations"]);
    expect(tools[0]).toMatchObject({ enable_image_understanding: false, enable_video_understanding: false });
    expect(JSON.stringify(body)).not.toMatch(/"type":"function"/);
  });
});

describe("extraction de la réponse", () => {
  it("lit le texte final, les citations (racine + annotations) et les appels d'outils", () => {
    const raw = xaiResponse({
      output: { hello: 1 },
      citations: ["https://x.com/a/status/1"],
      annotations: ["https://x.com/b/status/2"],
    });
    const ex = extractResponse(raw);
    expect(ex.outputText).toBe('{"hello":1}');
    expect(ex.citations).toEqual(["https://x.com/a/status/1", "https://x.com/b/status/2"]);
    expect(ex.toolCalls).toEqual([
      { kind: "x_search", name: "x_keyword_search", arguments: expect.stringContaining("my first game") },
    ]);
    expect(toolQuery(ex.toolCalls[0]!)).toBe('x_keyword_search: "my first game" filter:media');
  });

  it("accepte des citations sous forme d'objets et des appels x_search_call", () => {
    const raw = xaiResponse({
      output: "{}",
      citations: [{ url: "https://x.com/a/status/1" }] as unknown as string[],
      toolItems: [{ type: "x_search_call", id: "x1", status: "completed", arguments: "{\"query\":\"q\"}" }],
    });
    const ex = extractResponse(raw);
    expect(ex.citations).toEqual(["https://x.com/a/status/1"]);
    expect(ex.toolCalls[0]?.kind).toBe("x_search");
  });

  it("lit les citations des sources d'un appel d'outil et la forme {link}", () => {
    const raw = xaiResponse({
      output: "{}",
      citations: [{ link: "https://x.com/c/status/3" }] as unknown as string[],
      toolItems: [
        {
          type: "web_search_call",
          id: "w1",
          status: "completed",
          action: { type: "search", sources: [{ type: "url", url: "https://example.com/a" }] },
        },
      ],
    });
    const ex = extractResponse(raw);
    expect(ex.citations).toEqual(expect.arrayContaining(["https://x.com/c/status/3", "https://example.com/a"]));
    expect(ex.toolCalls[0]?.kind).toBe("web_search");
  });

  it("ne plante pas sur une réponse vide ou inattendue", () => {
    expect(extractResponse(null)).toEqual({ status: null, outputText: null, citations: [], toolCalls: [] });
    expect(extractResponse({ output: [1, "x", null] }).toolCalls).toEqual([]);
  });
});

describe("usage et coût", () => {
  it("prend le coût réel dans cost_in_usd_ticks et les compteurs X dans server_side_tool_usage_details", () => {
    const raw = xaiResponse({ output: "{}" });
    const u = parseUsage(raw, "grok-4.7", extractResponse(raw).toolCalls);
    expect(u.cost_usd_actual).toBeCloseTo(0.72, 6);
    expect(u).toMatchObject({ x_posts_fetched: 95, x_users_fetched: 4, x_search_calls: 4, usage_details_present: true });
    // 24k non cachés × 2 $ + 36k cachés × 0,5 $ + 6k sortie × 6 $ (par M) + 95 posts + 4 profils
    expect(u.cost_usd_estimated).toBeCloseTo(0.048 + 0.018 + 0.036 + 0.475 + 0.04, 4);
    expect(billedCost(u, 2)).toBeCloseTo(0.72, 6);
    expect(costMismatch(u)).toBe(false);
  });

  it("coût réel incohérent (unité de ticks) : le budget retient le plus élevé", () => {
    const tiny = xaiResponse({
      output: "{}",
      usage: {
        input_tokens: 60_000,
        output_tokens: 6_000,
        cost_in_usd_ticks: 720_000,
        server_side_tool_usage_details: { x_posts_fetched: 95, x_users_fetched: 4, x_search_calls: 4 },
      },
    });
    const u = parseUsage(tiny, "grok-4.7", []);
    expect(costMismatch(u)).toBe(true);
    expect(billedCost(u, 2)).toBe(u.cost_usd_estimated);
    expect(billedCost(u, 2)).toBeGreaterThan(0.5);
  });

  it("se replie sur les appels d'outils et l'estimation quand les détails manquent", () => {
    const raw = xaiResponse({ output: "{}", usage: { input_tokens: 1000, output_tokens: 100 } });
    const u = parseUsage(raw, "modele-inconnu", extractResponse(raw).toolCalls);
    expect(u).toMatchObject({ cost_usd_actual: null, x_posts_fetched: null, x_search_calls: 1, usage_details_present: false });
    // Posts facturés inconnus : on retient au moins la réserve, jamais un coût sous-estimé.
    expect(billedCost(u, 2)).toBe(2);
    expect(billedCost(parseUsage(xaiResponse({ output: "{}", usage: null }), "grok-4.7", []), 2)).toBe(2);
  });
});
