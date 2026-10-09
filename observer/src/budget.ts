import type { Config } from "./config";
import type { LedgerEntry } from "./store";

/**
 * Garde-fou exécutoire du §17 (« aucun agent ne doit augmenter silencieusement la consommation ») :
 * un scan est refusé si la dépense du jour (UTC) plus une réserve dépasse le budget quotidien.
 * Le vrai plafond dur reste côté compte xAI : crédits prépayés sans recharge automatique.
 */

export class BudgetExceededError extends Error {
  constructor(spent: number, reserve: number, cap: number) {
    super(
      `Budget du jour atteint : ${fmtUsd(spent)} dépensés + ${fmtUsd(reserve)} de réserve > ${fmtUsd(cap)}. ` +
        `Scan refusé. Ajuste OBSERVER_DAILY_BUDGET_USD si c'est voulu.`,
    );
    this.name = "BudgetExceededError";
  }
}

export function spentOnDay(ledger: LedgerEntry[], now: Date): number {
  const day = now.toISOString().slice(0, 10);
  return ledger.filter((e) => e.at.slice(0, 10) === day).reduce((s, e) => s + e.cost_usd, 0);
}

export function assertCanScan(ledger: LedgerEntry[], config: Config, now: Date): number {
  const spent = spentOnDay(ledger, now);
  if (spent + config.OBSERVER_SCAN_RESERVE_USD > config.OBSERVER_DAILY_BUDGET_USD) {
    throw new BudgetExceededError(spent, config.OBSERVER_SCAN_RESERVE_USD, config.OBSERVER_DAILY_BUDGET_USD);
  }
  return spent;
}

export function fmtUsd(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`;
}
