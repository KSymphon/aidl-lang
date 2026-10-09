import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fmtUsd, spentOnDay } from "./budget";
import { loadConfig } from "./config";
import { SCAN_TYPES, type ScanReport, type ScanType } from "./contract";
import { prepareScan, replayScan, runLiveScan } from "./scan";
import { FileStore } from "./store";

const USAGE = `Usage :
  npm run scan -- [--type morning|noon|evening] [--vertical indie-games] [--dry-run]
  npm run replay -- <fichier data/scans/....json>
  npm run ledger`;

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function parseType(v: string | undefined): ScanType {
  const t = (v ?? "evening") as ScanType;
  if (!SCAN_TYPES.includes(t)) throw new Error(`--type invalide : ${v}. ${USAGE}`);
  return t;
}

const MARK = { SHORTLIST: "SHORTLIST", WATCH: "SURVEILLER", REJECT: "REJETÉ" } as const;

export function formatReport(r: ScanReport, file: string): string {
  const out: string[] = [];
  const u = r.usage;
  out.push(
    `Scan ${r.type} · ${r.vertical} · ${r.model} · ${r.prompt_version}${r.mode === "replay" ? " · REJEU (aucun appel)" : ""}`,
  );
  out.push(`Fenêtre ${r.window.from_date} → ${r.window.to_date} · pistes : ${r.intents.join(", ") || "—"}`);
  if (u) {
    const posts = u.x_posts_fetched ?? "?";
    const users = u.x_users_fetched ?? "?";
    out.push(`Recherches X : ${u.x_search_calls} appels · ${posts} posts · ${users} profils facturés`);
    out.push(
      `Coût : ${u.cost_usd_actual === null ? "réel inconnu" : `réel ${fmtUsd(u.cost_usd_actual)}`} · estimé ${fmtUsd(u.cost_usd_estimated)} · tokens ${u.input_tokens} in (${u.cached_input_tokens} cache) / ${u.output_tokens} out`,
    );
  }
  if (r.tool_queries.length > 0) out.push(`Requêtes de Grok : ${r.tool_queries.join(" | ")}`);
  for (const a of r.alerts) out.push(`⚠ ${a}`);
  if (r.status === "failed") {
    out.push(`ÉCHEC ${r.error?.code} : ${r.error?.message}`);
  } else {
    const c = r.counts;
    out.push(
      `Candidats : ${c.returned} renvoyés → ${c.shortlist} shortlist · ${c.watch} à surveiller · ${c.reject} rejetés` +
        (r.posts_reviewed_estimate !== null ? ` (≈${r.posts_reviewed_estimate} posts examinés selon Grok)` : ""),
    );
    if (r.scan_notes) out.push(`Note du scan : ${r.scan_notes}`);
    for (const k of r.candidates) {
      const s = k.source;
      const reason = k.rejection_reason ? ` ${k.rejection_reason}` : "";
      out.push("");
      out.push(`[${String(k.priority).padStart(2)}] ${MARK[k.decision]}${reason}  ${s.name}${k.handle ? ` (@${k.handle})` : ""} — ${s.type}`);
      out.push(`     ${k.summary_line}`);
      out.push(`     Pourquoi : ${s.why_interesting}`);
      out.push(`     Sous-exposé : ${s.why_underexposed}`);
      out.push(`     Maintenant : ${s.why_now}`);
      out.push(
        `     Preuve : ${k.evidence.canonical_url ?? k.evidence.url} ${k.evidence.cited ? "✓ citée" : "✗ absente des citations"}` +
          (k.evidence.posted_at ? ` · posté le ${k.evidence.posted_at.slice(0, 10)}` : ""),
      );
      if (s.risks.length > 0) out.push(`     Risques : ${s.risks.join(" ; ")}`);
      if (k.seen_before) out.push(`     Déjà vu ${k.seen_before.times_seen} fois depuis le ${k.seen_before.first_seen_at.slice(0, 10)}`);
      if (k.flags.length > 0) out.push(`     Drapeaux : ${k.flags.join(", ")}`);
    }
    if (r.discarded.length > 0) {
      out.push("");
      out.push(`Écartés par Grok : ${r.discarded.map((d) => `${d.name} (${d.reason})`).join(", ")}`);
    }
  }
  out.push("");
  out.push(`Rapport complet et réponse brute : ${file}`);
  return out.join("\n");
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...args] = argv;
  const config = loadConfig();
  const store = new FileStore(config.OBSERVER_DATA_DIR);

  if (cmd === "scan") {
    const type = parseType(arg(args, "type"));
    const vertical = arg(args, "vertical") ?? "indie-games";
    if (args.includes("--dry-run")) {
      const prep = prepareScan(type, vertical, config, new Date());
      const spent = spentOnDay(await store.readLedger(), new Date());
      console.log(JSON.stringify(prep.body, null, 2));
      console.log(
        `\nDry-run : aucune requête envoyée. Budget du jour : ${fmtUsd(spent)} / ${fmtUsd(config.OBSERVER_DAILY_BUDGET_USD)} · réserve par scan ${fmtUsd(config.OBSERVER_SCAN_RESERVE_USD)}.`,
      );
      return 0;
    }
    if (!config.XAI_API_KEY) {
      console.error("XAI_API_KEY absent. Voir .env.example (ou --dry-run pour voir la requête sans l'envoyer).");
      return 2;
    }
    const { report, file } = await runLiveScan({ type, vertical }, { config, store });
    console.log(formatReport(report, file));
    return report.status === "succeeded" ? 0 : 1;
  }

  if (cmd === "replay") {
    const path = args.find((a) => !a.startsWith("--"));
    if (!path) throw new Error(USAGE);
    const saved: unknown = JSON.parse(await readFile(path, "utf8"));
    const { report, file } = await replayScan(
      saved,
      { type: parseType(arg(args, "type")), vertical: arg(args, "vertical") ?? "indie-games" },
      { config, store },
    );
    console.log(formatReport(report, file));
    return report.status === "succeeded" ? 0 : 1;
  }

  if (cmd === "ledger") {
    const ledger = await store.readLedger();
    const now = new Date();
    for (const e of ledger.slice(-20)) console.log(`${e.at}  ${e.scan_id}  ${fmtUsd(e.cost_usd)} (${e.source})`);
    console.log(
      `Aujourd'hui (UTC) : ${fmtUsd(spentOnDay(ledger, now))} / ${fmtUsd(config.OBSERVER_DAILY_BUDGET_USD)} · total : ${fmtUsd(ledger.reduce((s, e) => s + e.cost_usd, 0))}`,
    );
    return 0;
  }

  console.error(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error((err as Error).message);
      process.exit(1);
    },
  );
}
