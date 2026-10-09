import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ScanReport, SuggestedDecision } from "./contract";

/**
 * Stockage local du prototype (fichiers JSON sous OBSERVER_DATA_DIR). L'interface est volontairement
 * petite pour être portée telle quelle sur Supabase (tables scans, candidates, observations, ledger).
 */

/**
 * Une ligne par scan. « reserved » est écrit avant l'appel ; il est remplacé par le coût réel (« actual »),
 * l'estimation (« estimated ») ou 0 (« released », erreur non facturée). Un scan interrompu garde sa réserve.
 */
export interface LedgerEntry {
  scan_id: string;
  at: string;
  cost_usd: number;
  source: "reserved" | "actual" | "estimated" | "released";
}

export interface SeenEntry {
  first_seen_at: string;
  last_seen_at: string;
  times_seen: number;
  last_decision: SuggestedDecision;
}

export interface SavedScan {
  report: ScanReport;
  request: Record<string, unknown> | null;
  response_raw: unknown;
}

export interface Store {
  readLedger(): Promise<LedgerEntry[]>;
  /** Ajoute la ligne du scan, ou remplace celle qui porte le même scan_id. */
  recordLedger(entry: LedgerEntry): Promise<void>;
  readSeen(): Promise<Record<string, SeenEntry>>;
  writeSeen(seen: Record<string, SeenEntry>): Promise<void>;
  saveScan(scan: SavedScan): Promise<string>;
  acquireLock(staleMs: number): Promise<() => Promise<void>>;
}

export class ScanLockedError extends Error {
  constructor(since: string) {
    super(`Un scan est déjà en cours (verrou posé le ${since}). Un seul scan à la fois.`);
    this.name = "ScanLockedError";
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(tmp, path);
}

export class FileStore implements Store {
  constructor(private readonly dir: string) {}

  private path(name: string): string {
    return join(this.dir, name);
  }

  readLedger(): Promise<LedgerEntry[]> {
    return readJson(this.path("ledger.json"), [] as LedgerEntry[]);
  }

  async recordLedger(entry: LedgerEntry): Promise<void> {
    const ledger = (await this.readLedger()).filter((e) => e.scan_id !== entry.scan_id);
    ledger.push(entry);
    await writeJsonAtomic(this.path("ledger.json"), ledger);
  }

  readSeen(): Promise<Record<string, SeenEntry>> {
    return readJson(this.path("seen.json"), {} as Record<string, SeenEntry>);
  }

  writeSeen(seen: Record<string, SeenEntry>): Promise<void> {
    return writeJsonAtomic(this.path("seen.json"), seen);
  }

  async saveScan(scan: SavedScan): Promise<string> {
    const file = this.path(join("scans", `${scan.report.scan_id}.json`));
    await writeJsonAtomic(file, scan);
    return file;
  }

  async acquireLock(staleMs: number): Promise<() => Promise<void>> {
    const lock = this.path(".scan.lock");
    await mkdir(this.dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fh = await open(lock, "wx");
        const token = randomUUID();
        await fh.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString(), token }));
        await fh.close();
        // Ne supprime que son propre verrou (s'il a été repris comme périmé, il appartient à un autre scan).
        return async () => {
          const current = await readJson<{ token?: string } | null>(lock, null).catch(() => null);
          if (current?.token === token) await rm(lock, { force: true });
        };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        const info = await stat(lock).catch(() => null);
        if (info && Date.now() - info.mtimeMs > staleMs) {
          await rm(lock, { force: true });
          continue;
        }
        throw new ScanLockedError(info ? info.mtime.toISOString() : "?");
      }
    }
    throw new ScanLockedError("?");
  }
}
