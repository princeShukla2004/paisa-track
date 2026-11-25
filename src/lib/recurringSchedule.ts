import type { RecurringFrequency } from '../types/finance';

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

function parseIsoParts(iso: string): { year: number; monthIndex: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yStr, mStr, dStr] = iso.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const day = Number(dStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  return { year, monthIndex, day };
}

function formatIsoParts(year: number, monthIndex: number, day: number): string {
  const dt = new Date(year, monthIndex, day);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeNextDueDate(
  currentDueIso: string,
  frequency: RecurringFrequency,
  anchorStartDate?: string
): string {
  const current = parseIsoParts(currentDueIso);
  if (!current) return currentDueIso;

  const anchor = anchorStartDate ? parseIsoParts(anchorStartDate) : null;
  const anchorDay = anchor ? anchor.day : current.day;

  if (frequency === 'daily') {
    return formatIsoParts(current.year, current.monthIndex, current.day + 1);
  }

  if (frequency === 'weekly') {
    return formatIsoParts(current.year, current.monthIndex, current.day + 7);
  }

  if (frequency === 'monthly') {
    const rawTarget = new Date(current.year, current.monthIndex + 1, 1);
    const maxDay = new Date(rawTarget.getFullYear(), rawTarget.getMonth() + 1, 0).getDate();
    return formatIsoParts(
      rawTarget.getFullYear(),
      rawTarget.getMonth(),
      Math.min(anchorDay, maxDay)
    );
  }

  // yearly
  const nextYear = current.year + 1;
  const maxDay = new Date(nextYear, current.monthIndex + 1, 0).getDate();
  return formatIsoParts(nextYear, current.monthIndex, Math.min(anchorDay, maxDay));
}

export function collectDueOccurrences(
  initialNextDueDate: string,
  frequency: RecurringFrequency,
  todayIso: string,
  startDate: string,
  maxCycles = 24
): { dueDates: string[]; nextDueDate: string } {
  const dueDates: string[] = [];
  let cursor = initialNextDueDate;
  let guard = 0;

  while (cursor <= todayIso && guard < maxCycles) {
    dueDates.push(cursor);
    const next = computeNextDueDate(cursor, frequency, startDate);
    if (next <= cursor) break;
    cursor = next;
    guard += 1;
  }

  return { dueDates, nextDueDate: cursor };
}

export function toMonthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case 'daily':
      return amount * 30;
    case 'weekly':
      return (amount * 52) / 12;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
  }
}
