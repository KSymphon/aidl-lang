/**
 * Lecture défensive de la réponse brute de /v1/responses. Le format exact des citations et des appels
 * d'outils serveur n'est pas un contrat stable documenté : on accepte plusieurs formes connues, et la réponse
 * brute est toujours sauvegardée pour pouvoir rejouer le pipeline (npm run replay).
 */

const X_SEARCH_SUBTOOLS = new Set(["x_search", "x_user_search", "x_keyword_search", "x_semantic_search", "x_thread_fetch"]);
const WEB_SEARCH_SUBTOOLS = new Set(["web_search", "web_search_with_snippets", "browse_page"]);

export interface ToolCallInfo {
  kind: "x_search" | "web_search" | "function" | "other";
  name: string;
  arguments: string;
}

export interface ExtractedResponse {
  status: string | null;
  outputText: string | null;
  citations: string[];
  toolCalls: ToolCallInfo[];
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);

function urlFrom(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (isObject(entry)) return asString(entry.url) ?? asString(entry.link);
  return null;
}

export function extractResponse(raw: unknown): ExtractedResponse {
  const root = isObject(raw) ? raw : {};
  const output = Array.isArray(root.output) ? root.output : [];
  const citations = new Set<string>();
  const toolCalls: ToolCallInfo[] = [];
  let outputText: string | null = null;

  if (Array.isArray(root.citations)) {
    for (const c of root.citations) {
      const u = urlFrom(c);
      if (u) citations.add(u);
    }
  }

  for (const item of output) {
    if (!isObject(item)) continue;
    const type = asString(item.type) ?? "";

    if (type === "message") {
      const parts = Array.isArray(item.content) ? item.content : [];
      const texts: string[] = [];
      for (const part of parts) {
        if (!isObject(part)) continue;
        const t = asString(part.text);
        if (t && (part.type === "output_text" || part.type === "text")) texts.push(t);
        const annotations = Array.isArray(part.annotations) ? part.annotations : [];
        for (const a of annotations) {
          if (isObject(a) && a.type === "url_citation") {
            const u = asString(a.url);
            if (u) citations.add(u);
          }
        }
      }
      // La dernière réponse du modèle porte le JSON final.
      if (texts.length > 0) outputText = texts.join("");
      continue;
    }

    if (type === "function_call") {
      toolCalls.push({ kind: "function", name: asString(item.name) ?? "", arguments: asString(item.arguments) ?? "" });
      continue;
    }

    if (type.endsWith("_call")) {
      const name = asString(item.name) ?? type.replace(/_call$/, "");
      const args = asString(item.arguments) ?? asString(item.input) ?? "";
      const kind =
        type === "x_search_call" || X_SEARCH_SUBTOOLS.has(name)
          ? "x_search"
          : type === "web_search_call" || WEB_SEARCH_SUBTOOLS.has(name)
            ? "web_search"
            : "other";
      toolCalls.push({ kind, name, arguments: args });
      if (isObject(item.action) && Array.isArray(item.action.sources)) {
        for (const s of item.action.sources) {
          const u = urlFrom(s);
          if (u) citations.add(u);
        }
      }
    }
  }

  return { status: asString(root.status), outputText, citations: [...citations], toolCalls };
}

/** Extrait la requête lisible d'un appel d'outil (pour l'audit : « qu'a cherché Grok ? »). */
export function toolQuery(call: ToolCallInfo): string {
  try {
    const parsed: unknown = JSON.parse(call.arguments);
    if (isObject(parsed)) {
      const q = asString(parsed.query) ?? asString(parsed.q) ?? asString(parsed.username);
      if (q) return `${call.name}: ${q}`;
    }
  } catch {
    // arguments non JSON : on garde le texte brut
  }
  return call.arguments ? `${call.name}: ${call.arguments.slice(0, 200)}` : call.name;
}
