import { describe, expect, it } from "vitest";
import { BudgetExceededError, assertCanScan, spentOnDay } from "../src/budget";
import { UsageError, parseCliArgs } from "../src/cli";
import { parseModelJson } from "../src/scan";
import { NOW, testConfig } from "./fixtures";

describe("budget quotidien", () => {
  const entry = (at: string, cost: number) => ({ scan_id: at, at, cost_usd: cost, source: "actual" as const });

  it("ne compte que le jour UTC courant", () => {
    const ledger = [entry("2026-10-08T23:59:59.000Z", 4), entry("2026-10-09T00:00:00.000Z", 1), entry("2026-10-09T17:00:00.000Z", 0.5)];
    expect(spentOnDay(ledger, NOW)).toBe(1.5);
  });

  it("autorise un scan qui atteint exactement le plafond, refuse au-delà", () => {
    const config = testConfig({ OBSERVER_DAILY_BUDGET_USD: "5", OBSERVER_SCAN_RESERVE_USD: "2" });
    expect(() => assertCanScan([entry(NOW.toISOString(), 3)], config, NOW)).not.toThrow();
    expect(() => assertCanScan([entry(NOW.toISOString(), 3.01)], config, NOW)).toThrow(BudgetExceededError);
  });
});

describe("arguments de la CLI", () => {
  it("lit type, verticale et dry-run", () => {
    expect(parseCliArgs(["scan", "--type", "noon", "--vertical", "indie-games", "--dry-run"], {})).toMatchObject({
      cmd: "scan",
      type: "noon",
      vertical: "indie-games",
      dryRun: true,
    });
  });

  it("refuse toute option inconnue avant le moindre appel (faute de frappe = pas de scan payant)", () => {
    expect(() => parseCliArgs(["scan", "--dryrun"], {})).toThrow(UsageError);
    expect(() => parseCliArgs(["scan", "--type=noon"], {})).toThrow(UsageError);
    expect(() => parseCliArgs(["scan", "--type", "midnight"], {})).toThrow(UsageError);
    expect(() => parseCliArgs(["scan", "--type"], {})).toThrow(UsageError);
  });

  it("reconnaît `npm run scan --dry-run` (sans --) via npm_config_dry_run", () => {
    expect(parseCliArgs(["scan"], { npm_config_dry_run: "true" }).dryRun).toBe(true);
  });
});

describe("parseModelJson", () => {
  it("lit du JSON pur, retire les citations insérées et ignore une phrase d'introduction", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('{"a":1, [[1]](https://x.com/i/status/9) "b":2}')).toEqual({ a: 1, b: 2 });
    expect(parseModelJson('Je cherche sur X… {"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson("rien d'exploitable")).toBeUndefined();
  });
});
