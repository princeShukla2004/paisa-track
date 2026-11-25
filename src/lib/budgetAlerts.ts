import { formatCurrency } from './formatters';
import {
  FIELD_LIMITS,
  type BudgetCategory,
  type BudgetRecord,
  type CurrencyCode,
  type TransactionRecord,
} from '../types/finance';
import type { ToastVariant } from '../context/ToastContext';

export type BudgetThresholdLevel = 50 | 75 | 90 | 100;

export const BUDGET_THRESHOLDS: readonly BudgetThresholdLevel[] = [50, 75, 90, 100];

export type BudgetAlertSeverity = 'exceeded' | 'critical' | 'warning' | 'caution' | 'ok';

export interface BudgetAlertStatus {
  budgetId: string;
  category: BudgetCategory;
  month: string;
  limit: number;
  spent: number;
  remaining: number;
  pct: number;
  threshold: BudgetThresholdLevel | 0;
  crossedThresholds: BudgetThresholdLevel[];
  severity: BudgetAlertSeverity;
  dedupeKey: string;
}

export function getHighestBudgetThreshold(pct: number): BudgetThresholdLevel | 0 {
  if (pct >= 100) return 100;
  if (pct >= 90) return 90;
  if (pct >= 75) return 75;
  if (pct >= 50) return 50;
  return 0;
}

export function getBudgetSeverity(pct: number): BudgetAlertSeverity {
  if (pct >= 100) return 'exceeded';
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'warning';
  if (pct >= 50) return 'caution';
  return 'ok';
}

export function evaluateBudgetAlerts(
  budgets: BudgetRecord[],
  transactions: TransactionRecord[],
  monthFilter?: string
): BudgetAlertStatus[] {
  const results: BudgetAlertStatus[] = [];

  for (const b of budgets) {
    if (monthFilter && b.month !== monthFilter) continue;

    const spent = transactions
      .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(b.month))
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = b.limit - spent;
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    const threshold = getHighestBudgetThreshold(pct);
    const crossedThresholds = BUDGET_THRESHOLDS.filter((level) => pct >= level);
    const severity = getBudgetSeverity(pct);

    results.push({
      budgetId: b.id,
      category: b.category,
      month: b.month,
      limit: b.limit,
      spent,
      remaining,
      pct,
      threshold,
      crossedThresholds,
      severity,
      dedupeKey: `budget_${b.id}_${b.month}_${threshold}`,
    });
  }

  return results.sort((a, b) => b.pct - a.pct);
}

export function buildBudgetAlertCopy(
  status: BudgetAlertStatus,
  currency: CurrencyCode
): { title: string; message: string; variant: ToastVariant } {
  const threshold = status.threshold === 0 ? 50 : status.threshold;
  const spentStr = formatCurrency(status.spent, currency);
  const limitStr = formatCurrency(status.limit, currency);

  const title =
    threshold === 100
      ? `${status.category} Budget Exceeded (${Math.round(status.pct)}%)`
      : `${status.category} Budget Reached ${threshold}%`;

  const statusDetail =
    status.remaining < 0
      ? `${formatCurrency(Math.abs(status.remaining), currency)} over budget`
      : `${formatCurrency(status.remaining, currency)} remaining`;

  const message = `Spent ${spentStr} of your ${limitStr} limit (${statusDetail}).`;

  const variant: ToastVariant =
    threshold === 100 ? 'error' : threshold >= 75 ? 'warning' : 'info';

  return {
    title: title.slice(0, FIELD_LIMITS.TX_TITLE_MAX),
    message: message.slice(0, 400),
    variant,
  };
}
