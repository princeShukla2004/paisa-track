import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CURRENCY_META,
  CATEGORY_COLORS,
  type BudgetRecord,
  type CurrencyCode,
  type DateFormatOption,
  type SavingsGoalRecord,
  type TransactionCategory,
  type TransactionRecord,
  type UserProfile,
  type UserSettings,
} from '../types/finance';
import { formatCurrency, formatDateStr, toMonthKey } from './formatters';

export interface ReportFilterSummary {
  rangeLabel: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  typeFilter?: string;
  categoryFilter?: string;
  paymentFilter?: string;
  sortLabel?: string;
}

export interface ReportMetricItem {
  label: string;
  value: string;
  numericValue?: number;
  isCurrency?: boolean;
  note?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
}

export interface ReportCategoryItem {
  category: string;
  amount: number;
  sharePercent: number;
  txCount: number;
  color: string;
}

export interface ReportMonthlyRow {
  label: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
}

export interface ReportBudgetItem {
  category: string;
  month: string;
  limit: number;
  spent: number;
  remaining: number;
  pct: number;
  statusLabel: string;
}

export interface ReportGoalItem {
  title: string;
  category: string;
  currentAmount: number;
  targetAmount: number;
  targetDate: string;
  pct: number;
}

export interface ReportSectionSelection {
  includeInsights: boolean;
  includeCategories: boolean;
  includeMonthlyTrend: boolean;
  includeBudgets: boolean;
  includeGoals: boolean;
  includeTransactions: boolean;
}

export interface FinancialReportPayload {
  sourceTitle: string;
  accountName: string;
  accountEmail: string;
  isDemoMode: boolean;
  currency: CurrencyCode;
  dateFormat: DateFormatOption;
  generatedAtIso: string;
  generatedAtDisplay: string;
  filters: ReportFilterSummary;
  metrics: ReportMetricItem[];
  kpisRaw: {
    periodIncome: number;
    periodExpenses: number;
    netCashFlow: number;
    savingsRate: number;
  };
  insights: string[];
  categories: ReportCategoryItem[];
  monthlyRows: ReportMonthlyRow[];
  budgets: ReportBudgetItem[];
  goals: ReportGoalItem[];
  transactions: TransactionRecord[];
}

export function sanitizePdfText(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/₹/g, 'INR ')
    .replace(/€/g, 'EUR ')
    .replace(/£/g, 'GBP ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/\u00A0/g, ' ')
    .trim();
}

export function formatCurrencyForPdf(
  amount: number,
  currency: CurrencyCode = 'INR',
  options?: { decimals?: number }
): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.INR;
  const safe = Number.isFinite(amount) ? amount : 0;
  const decimals = options?.decimals ?? (Number.isInteger(safe) ? 0 : 2);
  const absFormatted = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(safe));
  const prefix = safe < 0 ? `-${currency} ` : `${currency} `;
  return `${prefix}${absFormatted}`;
}

export function getBudgetStatusLabel(pct: number): string {
  if (pct >= 100) return 'Exceeded';
  if (pct >= 90) return 'Critical (90%+)';
  if (pct >= 75) return 'Approaching (75%+)';
  if (pct >= 50) return 'On Track (50%+)';
  return 'Healthy';
}

export function buildDeterministicInsights(params: {
  transactions: TransactionRecord[];
  categories: ReportCategoryItem[];
  budgets: ReportBudgetItem[];
  goals: ReportGoalItem[];
  periodIncome: number;
  periodExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  currency: CurrencyCode;
  dateFormat: DateFormatOption;
}): string[] {
  const {
    transactions,
    categories,
    budgets,
    goals,
    periodIncome,
    periodExpenses,
    netCashFlow,
    savingsRate,
    currency,
    dateFormat,
  } = params;

  const insights: string[] = [];

  if (transactions.length === 0) {
    insights.push(
      'No transactions match the currently selected filters. Adjust your date range or filter criteria to review cash flow activity.'
    );
    return insights;
  }

  // 1. Cash flow & savings rate
  if (periodIncome > 0) {
    const flowDirection = netCashFlow >= 0 ? 'net surplus' : 'net deficit';
    insights.push(
      `Recorded ${formatCurrency(periodIncome, currency)} in income against ${formatCurrency(
        periodExpenses,
        currency
      )} in expenses, yielding a ${flowDirection} of ${formatCurrency(
        Math.abs(netCashFlow),
        currency
      )} (${savingsRate.toFixed(1)}% savings rate).`
    );
  } else if (periodExpenses > 0) {
    insights.push(
      `Total filtered outflow stands at ${formatCurrency(
        periodExpenses,
        currency
      )} across ${transactions.filter((t) => t.type === 'expense').length} expense entries with no income logged in this scope.`
    );
  }

  // 2. Top spending category
  if (categories.length > 0) {
    const top = categories[0];
    const second = categories[1];
    const secondText = second
      ? ` Followed by ${second.category} at ${formatCurrency(second.amount, currency)} (${second.sharePercent.toFixed(1)}%).`
      : '';
    insights.push(
      `Highest expenditure category is ${top.category} at ${formatCurrency(
        top.amount,
        currency
      )} (${top.sharePercent.toFixed(1)}% of total expenses across ${top.txCount} transaction${
        top.txCount === 1 ? '' : 's'
      }).${secondText}`
    );
  }

  // 3. Largest single expense & payment method concentration
  const expenses = transactions.filter((t) => t.type === 'expense');
  if (expenses.length > 0) {
    const largestExpense = expenses.reduce((max, cur) => (cur.amount > max.amount ? cur : max), expenses[0]);
    const pmCounts = new Map<string, { count: number; amount: number }>();
    for (const tx of expenses) {
      const cur = pmCounts.get(tx.paymentMethod) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += tx.amount;
      pmCounts.set(tx.paymentMethod, cur);
    }
    const topPm = Array.from(pmCounts.entries()).sort((a, b) => b[1].amount - a[1].amount)[0];
    const pmNote = topPm
      ? ` Most spending volume (${formatCurrency(topPm[1].amount, currency)}) was routed via ${topPm[0]}.`
      : '';
    insights.push(
      `Largest single expense was "${largestExpense.title}" (${largestExpense.category}) for ${formatCurrency(
        largestExpense.amount,
        currency
      )} on ${formatDateStr(largestExpense.date, dateFormat)}.${pmNote}`
    );
  }

  // 4. Budget status summary
  if (budgets.length > 0) {
    const exceeded = budgets.filter((b) => b.pct >= 100);
    const warning = budgets.filter((b) => b.pct >= 75 && b.pct < 100);
    if (exceeded.length > 0) {
      insights.push(
        `Budget alert: ${exceeded.map((b) => `${b.category} (${b.pct}%)`).join(', ')} exceeded monthly spending limits.`
      );
    } else if (warning.length > 0) {
      insights.push(
        `Budget watch: ${warning.map((b) => `${b.category} (${b.pct}%)`).join(', ')} reached 75% or more of monthly limits.`
      );
    } else {
      insights.push(
        `All ${budgets.length} tracked monthly category budgets remain comfortably below 75% utilization.`
      );
    }
  }

  // 5. Savings goals snapshot
  if (goals.length > 0) {
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
    insights.push(
      `Active savings goals stand at ${formatCurrency(totalSaved, currency)} saved toward ${formatCurrency(
        totalTarget,
        currency
      )} total targets (${overallPct.toFixed(1)}% funded across ${goals.length} goal${goals.length === 1 ? '' : 's'}).`
    );
  }

  return insights;
}

export function buildFinancialReportPayload(params: {
  sourceTitle: string;
  filteredTransactions: TransactionRecord[];
  allTransactions: TransactionRecord[];
  budgets: BudgetRecord[];
  goals: SavingsGoalRecord[];
  profile: UserProfile | null;
  settings: UserSettings;
  isDemoMode: boolean;
  filters: ReportFilterSummary;
  budgetMonthKey?: string;
  monthlyRows?: ReportMonthlyRow[];
  extraMetrics?: ReportMetricItem[];
}): FinancialReportPayload {
  const {
    sourceTitle,
    filteredTransactions,
    allTransactions,
    budgets,
    goals,
    profile,
    settings,
    isDemoMode,
    filters,
    budgetMonthKey,
    monthlyRows = [],
    extraMetrics,
  } = params;

  const currency = settings.currency;
  const dateFormat = settings.dateFormat;

  const periodIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const periodExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const netCashFlow = periodIncome - periodExpenses;
  const savingsRate = periodIncome > 0 ? (netCashFlow / periodIncome) * 100 : 0;

  // Category breakdown from filtered transactions
  const catMap = new Map<TransactionCategory, { amount: number; txCount: number }>();
  for (const tx of filteredTransactions) {
    if (tx.type !== 'expense') continue;
    const cur = catMap.get(tx.category) || { amount: 0, txCount: 0 };
    cur.amount += tx.amount;
    cur.txCount += 1;
    catMap.set(tx.category, cur);
  }
  const categories: ReportCategoryItem[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      txCount: data.txCount,
      sharePercent: periodExpenses > 0 ? (data.amount / periodExpenses) * 100 : 0,
      color: CATEGORY_COLORS[category] || '#64748B',
    }))
    .sort((a, b) => b.amount - a.amount);

  // Active budgets for month
  const now = new Date();
  const fallbackMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetMonth =
    budgetMonthKey ||
    (filters.startDate ? toMonthKey(filters.startDate) : fallbackMonthKey);

  const monthBudgets = budgets.filter((b) => b.month === targetMonth);
  const activeBudgets = monthBudgets.length > 0 ? monthBudgets : budgets;

  const reportBudgets: ReportBudgetItem[] = activeBudgets
    .map((b) => {
      const spent = allTransactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(b.month))
        .reduce((s, t) => s + t.amount, 0);
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      return {
        category: b.category,
        month: b.month,
        limit: b.limit,
        spent,
        remaining: b.limit - spent,
        pct,
        statusLabel: getBudgetStatusLabel(pct),
      };
    })
    .sort((a, b) => b.pct - a.pct);

  const reportGoals: ReportGoalItem[] = goals.map((g) => ({
    title: g.title,
    category: g.category,
    currentAmount: g.currentAmount,
    targetAmount: g.targetAmount,
    targetDate: g.targetDate,
    pct: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
  }));

  const defaultMetrics: ReportMetricItem[] = [
    {
      label: 'Filtered Income',
      value: formatCurrency(periodIncome, currency),
      numericValue: periodIncome,
      isCurrency: true,
      note: `${filteredTransactions.filter((t) => t.type === 'income').length} entries`,
      tone: 'positive',
    },
    {
      label: 'Filtered Expenses',
      value: formatCurrency(periodExpenses, currency),
      numericValue: periodExpenses,
      isCurrency: true,
      note: `${filteredTransactions.filter((t) => t.type === 'expense').length} entries`,
      tone: 'negative',
    },
    {
      label: 'Net Cash Flow',
      value: formatCurrency(netCashFlow, currency),
      numericValue: netCashFlow,
      isCurrency: true,
      note: netCashFlow >= 0 ? 'Net surplus' : 'Net deficit',
      tone: netCashFlow >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Savings Rate',
      value: `${savingsRate.toFixed(1)}%`,
      isCurrency: false,
      note: periodIncome > 0 ? 'Income retained' : 'No income in scope',
      tone: 'accent',
    },
  ];

  const insights = buildDeterministicInsights({
    transactions: filteredTransactions,
    categories,
    budgets: reportBudgets,
    goals: reportGoals,
    periodIncome,
    periodExpenses,
    netCashFlow,
    savingsRate,
    currency,
    dateFormat,
  });

  const nowDt = new Date();
  const generatedAtIso = nowDt.toISOString();
  const generatedAtDisplay = nowDt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    sourceTitle,
    accountName: isDemoMode
      ? profile?.displayName || 'Prince Kumar'
      : profile?.displayName || settings.email?.split('@')[0] || 'PaisaTrack Member',
    accountEmail: isDemoMode ? settings.email || 'demo.preview@paisatrack.app' : settings.email || '',
    isDemoMode,
    currency,
    dateFormat,
    generatedAtIso,
    generatedAtDisplay,
    filters,
    metrics: extraMetrics && extraMetrics.length > 0 ? extraMetrics : defaultMetrics,
    kpisRaw: {
      periodIncome,
      periodExpenses,
      netCashFlow,
      savingsRate,
    },
    insights,
    categories,
    monthlyRows,
    budgets: reportBudgets,
    goals: reportGoals,
    transactions: filteredTransactions,
  };
}

function getLastAutoTableY(doc: jsPDF, fallbackY: number): number {
  const internalDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return internalDoc.lastAutoTable?.finalY ?? fallbackY;
}

function ensureSpace(doc: jsPDF, currentY: number, requiredHeight: number, topMargin = 16): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredHeight > pageHeight - 16) {
    doc.addPage();
    return topMargin;
  }
  return currentY;
}

function drawSectionHeading(doc: jsPDF, title: string, subtitle: string | undefined, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(title), 14, y);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(subtitle), pageWidth - 14, y, { align: 'right' });
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, y + 2, pageWidth - 14, y + 2);
  return y + 6.5;
}

export function exportFinancialReportPdf(
  payload: FinancialReportPayload,
  sections: ReportSectionSelection
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 28;

  // Header Banner
  doc.setFillColor(16, 24, 39); // #101827
  doc.rect(0, 0, pageWidth, 27, 'F');
  doc.setFillColor(124, 58, 237); // #7C3AED accent strip
  doc.rect(0, 27, pageWidth, 1.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PaisaTrack', 14, 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(196, 181, 253);
  doc.text('Your Money. Your Goals. Your Future.', 14, 18.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(payload.sourceTitle), pageWidth - 14, 12.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${sanitizePdfText(payload.generatedAtDisplay)}`, pageWidth - 14, 18.5, {
    align: 'right',
  });

  // Account & Filter Metadata Card
  let y = 34;
  const activeFilters: string[] = [`Range: ${payload.filters.rangeLabel}`];
  if (payload.filters.startDate || payload.filters.endDate) {
    const startLabel = payload.filters.startDate
      ? formatDateStr(payload.filters.startDate, payload.dateFormat)
      : 'Earliest';
    const endLabel = payload.filters.endDate
      ? formatDateStr(payload.filters.endDate, payload.dateFormat)
      : 'Latest';
    activeFilters.push(`Dates: ${startLabel} to ${endLabel}`);
  }
  if (payload.filters.typeFilter && payload.filters.typeFilter !== 'all') {
    activeFilters.push(`Type: ${payload.filters.typeFilter}`);
  }
  if (payload.filters.categoryFilter && payload.filters.categoryFilter !== 'all') {
    activeFilters.push(`Category: ${payload.filters.categoryFilter}`);
  }
  if (payload.filters.paymentFilter && payload.filters.paymentFilter !== 'all') {
    activeFilters.push(`Method: ${payload.filters.paymentFilter}`);
  }
  if (payload.filters.searchQuery) {
    activeFilters.push(`Search: "${payload.filters.searchQuery}"`);
  }
  if (payload.filters.sortLabel) {
    activeFilters.push(`Sort: ${payload.filters.sortLabel}`);
  }

  const filterLine = sanitizePdfText(activeFilters.join('  |  '));
  const wrappedFilters = doc.splitTextToSize(filterLine, contentWidth - 8);
  const metaBoxHeight = 14 + wrappedFilters.length * 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, contentWidth, metaBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const accountText = payload.accountEmail
    ? `${payload.accountName}  (${payload.accountEmail})`
    : payload.accountName;
  doc.text(sanitizePdfText(accountText), 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Currency: ${payload.currency}  |  Matching Records: ${payload.transactions.length}`,
    pageWidth - 18,
    y + 6,
    { align: 'right' }
  );

  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(wrappedFilters, 18, y + 11.5);

  y += metaBoxHeight + 7;

  // Executive KPI Cards
  if (payload.metrics.length > 0) {
    const metricsToShow = payload.metrics.slice(0, 5);
    const cols = metricsToShow.length;
    const gap = 3;
    const cardW = (contentWidth - gap * (cols - 1)) / cols;
    const cardH = 19;

    y = ensureSpace(doc, y, cardH + 6);
    metricsToShow.forEach((m, idx) => {
      const x = 14 + idx * (cardW + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(sanitizePdfText(m.label), x + 3, y + 5.2);

      const displayVal =
        m.isCurrency && typeof m.numericValue === 'number'
          ? formatCurrencyForPdf(m.numericValue, payload.currency)
          : sanitizePdfText(m.value);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cols >= 5 ? 9.2 : 10.5);
      if (m.tone === 'positive') doc.setTextColor(5, 150, 105);
      else if (m.tone === 'negative') doc.setTextColor(225, 29, 72);
      else if (m.tone === 'accent') doc.setTextColor(124, 58, 237);
      else doc.setTextColor(15, 23, 42);
      doc.text(displayVal, x + 3, y + 11.8);

      if (m.note) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.6);
        doc.setTextColor(148, 163, 184);
        doc.text(sanitizePdfText(m.note), x + 3, y + 16.4);
      }
    });
    y += cardH + 8;
  }

  // Executive Dashboard Insights
  if (sections.includeInsights && payload.insights.length > 0) {
    y = ensureSpace(doc, y, 28);
    y = drawSectionHeading(
      doc,
      'Executive Financial Insights',
      'Computed from filtered records',
      y
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    for (const insight of payload.insights) {
      const cleanLine = sanitizePdfText(insight);
      const wrapped = doc.splitTextToSize(cleanLine, contentWidth - 7);
      const blockH = wrapped.length * 4.2 + 1.8;
      y = ensureSpace(doc, y, blockH);

      doc.setFillColor(124, 58, 237);
      doc.circle(16, y - 1.1, 0.85, 'F');
      doc.text(wrapped, 19.5, y);
      y += blockH;
    }
    y += 4;
  }

  // Category Breakdown Table
  if (sections.includeCategories && payload.categories.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionHeading(
      doc,
      'Expense Category Breakdown',
      `${payload.categories.length} active categories`,
      y
    );

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Category', 'Transactions', 'Share of Spend', 'Total Amount']],
      body: payload.categories.map((c) => [
        sanitizePdfText(c.category),
        String(c.txCount),
        `${c.sharePercent.toFixed(1)}%`,
        formatCurrencyForPdf(c.amount, payload.currency),
      ]),
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });
    y = getLastAutoTableY(doc, y) + 8;
  }

  // Monthly Trend Table
  if (sections.includeMonthlyTrend && payload.monthlyRows.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionHeading(
      doc,
      'Monthly Cash Flow Summary',
      `${payload.monthlyRows.length} month(s)`,
      y
    );

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Month', 'Income', 'Expenses', 'Net Cash Flow', 'Savings Rate']],
      body: payload.monthlyRows.map((m) => [
        sanitizePdfText(m.label),
        formatCurrencyForPdf(m.income, payload.currency),
        formatCurrencyForPdf(m.expense, payload.currency),
        formatCurrencyForPdf(m.net, payload.currency),
        `${m.savingsRate.toFixed(1)}%`,
      ]),
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
      },
    });
    y = getLastAutoTableY(doc, y) + 8;
  }

  // Budget Utilization Table
  if (sections.includeBudgets && payload.budgets.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionHeading(
      doc,
      'Budget Utilization',
      `${payload.budgets.length} tracked category limit(s)`,
      y
    );

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Category', 'Month', 'Spent', 'Limit', 'Remaining', 'Utilization', 'Status']],
      body: payload.budgets.map((b) => [
        sanitizePdfText(b.category),
        b.month,
        formatCurrencyForPdf(b.spent, payload.currency),
        formatCurrencyForPdf(b.limit, payload.currency),
        formatCurrencyForPdf(b.remaining, payload.currency),
        `${b.pct}%`,
        b.statusLabel,
      ]),
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.4,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });
    y = getLastAutoTableY(doc, y) + 8;
  }

  // Savings Goals Table
  if (sections.includeGoals && payload.goals.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionHeading(
      doc,
      'Savings Goals Progress',
      `${payload.goals.length} active goal(s)`,
      y
    );

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Goal', 'Category', 'Saved', 'Target', 'Progress', 'Target Date']],
      body: payload.goals.map((g) => [
        sanitizePdfText(g.title),
        sanitizePdfText(g.category),
        formatCurrencyForPdf(g.currentAmount, payload.currency),
        formatCurrencyForPdf(g.targetAmount, payload.currency),
        `${g.pct}%`,
        formatDateStr(g.targetDate, payload.dateFormat),
      ]),
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.4,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });
    y = getLastAutoTableY(doc, y) + 8;
  }

  // Filtered Transactions Ledger
  if (sections.includeTransactions) {
    y = ensureSpace(doc, y, 32);
    y = drawSectionHeading(
      doc,
      'Filtered Transaction Ledger',
      `${payload.transactions.length} matching transaction(s)`,
      y
    );

    if (payload.transactions.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No transactions matched the active filter criteria.', 14, y + 3);
    } else {
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14, bottom: 18 },
        showHead: 'everyPage',
        head: [['Date', 'Transaction', 'Category', 'Method', 'Type', 'Amount']],
        body: payload.transactions.map((tx) => {
          const titleWithNotes = tx.notes
            ? `${sanitizePdfText(tx.title)}\n${sanitizePdfText(tx.notes)}`
            : sanitizePdfText(tx.title);
          const signedAmount =
            tx.type === 'income'
              ? `+${formatCurrencyForPdf(tx.amount, payload.currency)}`
              : `-${formatCurrencyForPdf(tx.amount, payload.currency)}`;
          return [
            formatDateStr(tx.date, payload.dateFormat),
            titleWithNotes,
            sanitizePdfText(tx.category),
            sanitizePdfText(tx.paymentMethod),
            tx.type === 'income' ? 'Income' : 'Expense',
            signedAmount,
          ];
        }),
        foot: [
          [
            '',
            `Totals (${payload.transactions.length} entries)`,
            '',
            '',
            'Net',
            formatCurrencyForPdf(payload.kpisRaw.netCashFlow, payload.currency),
          ],
        ],
        showFoot: 'lastPage',
        theme: 'striped',
        styles: {
          font: 'helvetica',
          fontSize: 7.8,
          cellPadding: 2.3,
          textColor: [30, 41, 59],
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [16, 24, 39],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 23 },
          1: { cellWidth: 56 },
          2: { cellWidth: 24 },
          3: { cellWidth: 26 },
          4: { cellWidth: 17 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const rawText = String(data.cell.text?.[0] ?? '');
            if (rawText.startsWith('+')) {
              data.cell.styles.textColor = [5, 150, 105];
            } else {
              data.cell.styles.textColor = [15, 23, 42];
            }
          }
        },
      });
    }
  }

  // Page Footer across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(14, pageHeight - 11.5, pageWidth - 14, pageHeight - 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const footerTag = payload.isDemoMode
      ? 'PaisaTrack Financial Report  |  Sample Demo Portfolio'
      : 'PaisaTrack Personal Finance Report  |  Private Statement';
    doc.text(footerTag, 14, pageHeight - 7);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  const filename = `paisatrack-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

function sanitizeClonedDocumentForHtml2Canvas(clonedDoc: Document): void {
  const appRoot = clonedDoc.getElementById('root');
  if (appRoot) {
    appRoot.style.display = 'none';
  }

  const portalRoot = clonedDoc.getElementById('paisatrack-report-portal');
  if (portalRoot) {
    portalRoot.style.display = 'none';
  }

  const captureRoot = clonedDoc.getElementById('paisatrack-pdf-capture-root');
  if (captureRoot) {
    captureRoot.style.position = 'static';
    captureRoot.style.left = '0px';
    captureRoot.style.top = '0px';
    captureRoot.style.visibility = 'visible';
    captureRoot.style.opacity = '1';
    captureRoot.style.zIndex = '1';
  }

  const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
  for (const styleEl of styleTags) {
    const cssText = styleEl.textContent || '';
    if (/oklch|oklab|color-mix/i.test(cssText)) {
      styleEl.remove();
    }
  }

  const linkTags = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
  for (const linkEl of linkTags) {
    const href = linkEl.getAttribute('href') || '';
    if (!href.includes('fonts.googleapis.com')) {
      linkEl.remove();
    }
  }

  const resetStyle = clonedDoc.createElement('style');
  resetStyle.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
  `;
  clonedDoc.head.appendChild(resetStyle);
}

export async function exportHtmlReportToPdf(
  containerEl: HTMLElement,
  payload: FinancialReportPayload,
  filenamePrefix = 'paisatrack-analytics-report'
): Promise<string> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const blocks = Array.from(containerEl.querySelectorAll<HTMLElement>('[data-pdf-block]'));
  if (blocks.length === 0) {
    throw new Error('No printable report sections available to export.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const marginTop = 12;
  const marginBottom = 16;
  const contentWidth = pageWidth - marginX * 2;
  const maxPageBottom = pageHeight - marginBottom;

  let currentY = marginTop;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const canvas = await html2canvas(block, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      onclone: sanitizeClonedDocumentForHtml2Canvas,
    });

    const imgWidthMm = contentWidth;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
    const maxSingleBlockHeight = maxPageBottom - marginTop;

    if (currentY > marginTop && currentY + imgHeightMm > maxPageBottom) {
      doc.addPage();
      currentY = marginTop;
    }

    let renderWidth = imgWidthMm;
    let renderHeight = imgHeightMm;
    let renderX = marginX;

    if (renderHeight > maxSingleBlockHeight) {
      const ratio = maxSingleBlockHeight / renderHeight;
      renderHeight = maxSingleBlockHeight;
      renderWidth = imgWidthMm * ratio;
      renderX = marginX + (contentWidth - renderWidth) / 2;
    }

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', renderX, currentY, renderWidth, renderHeight, undefined, 'FAST');
    currentY += renderHeight + 4;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 11.5, pageWidth - marginX, pageHeight - 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const footerTag = payload.isDemoMode
      ? 'PaisaTrack Analytics Report  |  Sample Demo Portfolio'
      : 'PaisaTrack Personal Finance Report  |  Confidential Statement';
    doc.text(footerTag, marginX, pageHeight - 7);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
  }

  const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
