import {
  CURRENCY_META,
  type CurrencyCode,
  type DateFilterPreset,
  type DateFormatOption,
  type TransactionRecord,
} from '../types/finance';

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'INR',
  options?: { compact?: boolean; decimals?: number }
): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.INR;
  const safe = Number.isFinite(amount) ? amount : 0;
  if (options?.compact && Math.abs(safe) >= 100000) {
    if (currency === 'INR') {
      if (Math.abs(safe) >= 10000000) {
        return `${meta.symbol}${(safe / 10000000).toFixed(2)}Cr`;
      }
      return `${meta.symbol}${(safe / 100000).toFixed(2)}L`;
    }
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safe);
  }
  const decimals = options?.decimals ?? (Number.isInteger(safe) ? 0 : 2);
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatDateStr(dateIso: string, format: DateFormatOption = 'DD MMM YYYY'): string {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return dateIso || '';
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return dateIso;

  if (format === 'YYYY-MM-DD') {
    return dateIso;
  }
  if (format === 'MM/DD/YYYY') {
    return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toMonthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getDateRangeForPreset(
  preset: DateFilterPreset,
  customStart?: string,
  customEnd?: string,
  refDate: Date = new Date()
): { start: string; end: string } {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const d = refDate.getDate();

  if (preset === 'today') {
    const iso = toIsoDate(refDate);
    return { start: iso, end: iso };
  }
  if (preset === 'week') {
    const dayOfWeek = refDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startDt = new Date(y, m, d - diffToMonday);
    const endDt = new Date(y, m, d);
    return { start: toIsoDate(startDt), end: toIsoDate(endDt) };
  }
  if (preset === 'month') {
    const startDt = new Date(y, m, 1);
    const endDt = new Date(y, m + 1, 0);
    return { start: toIsoDate(startDt), end: toIsoDate(endDt) };
  }
  if (preset === 'last_month') {
    const startDt = new Date(y, m - 1, 1);
    const endDt = new Date(y, m, 0);
    return { start: toIsoDate(startDt), end: toIsoDate(endDt) };
  }
  if (preset === 'year') {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  return {
    start: customStart || `${y}-${String(m + 1).padStart(2, '0')}-01`,
    end: customEnd || toIsoDate(refDate),
  };
}

export function filterTransactionsByDateRange(
  transactions: TransactionRecord[],
  start: string,
  end: string
): TransactionRecord[] {
  return transactions.filter((t) => {
    if (start && t.date < start) return false;
    if (end && t.date > end) return false;
    return true;
  });
}

export function calculatePercentDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface EmiScheduleRow {
  month: number;
  emi: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

export function calculateEmiBreakdown(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): {
  monthlyEmi: number;
  totalPayment: number;
  totalInterest: number;
  schedule: EmiScheduleRow[];
} {
  if (principal <= 0 || tenureMonths <= 0) {
    return { monthlyEmi: 0, totalPayment: 0, totalInterest: 0, schedule: [] };
  }

  const monthlyRate = annualRatePercent / 12 / 100;
  let monthlyEmi = 0;

  if (monthlyRate === 0) {
    monthlyEmi = principal / tenureMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    monthlyEmi = (principal * monthlyRate * factor) / (factor - 1);
  }

  const schedule: EmiScheduleRow[] = [];
  let balance = principal;
  let totalPayment = 0;
  let totalInterest = 0;

  for (let m = 1; m <= tenureMonths; m++) {
    const interestPaid = balance * monthlyRate;
    let principalPaid = monthlyEmi - interestPaid;
    let actualEmi = monthlyEmi;

    if (m === tenureMonths || principalPaid > balance) {
      principalPaid = balance;
      actualEmi = principalPaid + interestPaid;
    }

    balance = Math.max(0, balance - principalPaid);
    totalPayment += actualEmi;
    totalInterest += interestPaid;

    schedule.push({
      month: m,
      emi: actualEmi,
      principalPaid,
      interestPaid,
      remainingBalance: balance,
    });
  }

  return {
    monthlyEmi,
    totalPayment,
    totalInterest,
    schedule,
  };
}

export function calculateMonthsRemaining(targetDateIso: string, fromDate: Date = new Date()): number {
  const [y, m, d] = targetDateIso.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const target = new Date(y, m - 1, d);
  const diffMonths =
    (target.getFullYear() - fromDate.getFullYear()) * 12 +
    (target.getMonth() - fromDate.getMonth()) +
    (target.getDate() >= fromDate.getDate() ? 0 : -1);
  return Math.max(1, diffMonths);
}

export function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function parseCsvLines(rawText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    const next = rawText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (ch !== '\r') {
        currentCell += ch;
      }
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}
