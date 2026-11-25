import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileDown, Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_COLORS, type TransactionCategory } from '../../types/finance';
import {
  escapeCsvCell,
  filterTransactionsByDateRange,
  formatCurrency,
  getMonthLabel,
  toIsoDate,
  toMonthKey,
} from '../../lib/formatters';
import {
  buildFinancialReportPayload,
  exportHtmlReportToPdf,
  type ReportSectionSelection,
} from '../../lib/pdfReport';
import { PdfCaptureTemplate } from './PdfCaptureTemplate';
import { ReportPreviewModal } from './ReportPreviewModal';
import { SpendingTrendsCard } from './SpendingTrendsCard';

type AnalyticsRange = '1m' | '3m' | '6m' | '1y' | 'all' | 'custom';

const ANALYTICS_REPORT_SECTIONS: ReportSectionSelection = {
  includeInsights: true,
  includeCategories: true,
  includeMonthlyTrend: true,
  includeBudgets: true,
  includeGoals: true,
  includeTransactions: true,
};

export function AnalyticsView() {
  const { isDemoMode } = useAuth();
  const { transactions, budgets, goals, profile, settings } = useFinance();
  const { showToast } = useToast();

  const [rangeMode, setRangeMode] = useState<AnalyticsRange>('6m');
  const [customStart, setCustomStart] = useState(() => {
    const dt = new Date();
    dt.setMonth(dt.getMonth() - 5);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEnd, setCustomEnd] = useState(() => toIsoDate(new Date()));
  const [reportOpen, setReportOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const dateBounds = useMemo(() => {
    const now = new Date();
    const end = toIsoDate(now);
    if (rangeMode === 'all') return { start: '', end: '' };
    if (rangeMode === 'custom') return { start: customStart, end: customEnd };
    const monthsBack =
      rangeMode === '1m' ? 0 : rangeMode === '3m' ? 2 : rangeMode === '6m' ? 5 : 11;
    const startDt = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    return { start: toIsoDate(startDt), end };
  }, [rangeMode, customStart, customEnd]);

  const scopedTxs = useMemo(
    () => filterTransactionsByDateRange(transactions, dateBounds.start, dateBounds.end),
    [transactions, dateBounds]
  );

  const analytics = useMemo(() => {
    const totalIncome = scopedTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = scopedTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const netCashFlow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;

    // Average daily spending across active span
    const dates = scopedTxs.map((t) => t.date).sort();
    let daySpan = 30;
    if (dates.length >= 2) {
      const startMs = new Date(dates[0]).getTime();
      const endMs = new Date(dates[dates.length - 1]).getTime();
      daySpan = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
    } else if (rangeMode === '1m') {
      daySpan = Math.max(1, new Date().getDate());
    }
    const avgDailySpend = totalExpenses / daySpan;

    // Monthly cash flow table & chart
    const monthMap = new Map<string, { income: number; expense: number }>();
    for (const t of scopedTxs) {
      const mk = toMonthKey(t.date);
      const cur = monthMap.get(mk) || { income: 0, expense: 0 };
      if (t.type === 'income') cur.income += t.amount;
      else cur.expense += t.amount;
      monthMap.set(mk, cur);
    }

    const monthlyRows = Array.from(monthMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([mk, val], idx, arr) => {
        const net = val.income - val.expense;
        const rate = val.income > 0 ? (net / val.income) * 100 : 0;
        const prevExp = idx > 0 ? arr[idx - 1][1].expense : 0;
        const momExpenseChange =
          idx > 0 && prevExp > 0 ? ((val.expense - prevExp) / prevExp) * 100 : null;
        return {
          monthKey: mk,
          label: getMonthLabel(mk),
          income: val.income,
          expense: val.expense,
          net,
          savingsRate: Number(rate.toFixed(1)),
          momExpenseChange,
        };
      });

    // Category breakdown
    const catMap = new Map<TransactionCategory, number>();
    for (const t of scopedTxs) {
      if (t.type !== 'expense') continue;
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    }
    const categories = Array.from(catMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        share: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        color: CATEGORY_COLORS[category] || '#64748B',
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalIncome,
      totalExpenses,
      netCashFlow,
      savingsRate,
      avgDailySpend,
      monthlyRows,
      categories,
    };
  }, [scopedTxs, rangeMode]);

  const reportPayload = useMemo(() => {
    const rangeLabels: Record<AnalyticsRange, string> = {
      '1m': 'This Month',
      '3m': 'Last 3 Months',
      '6m': 'Last 6 Months',
      '1y': 'This Year',
      all: 'All Time',
      custom: 'Custom Range',
    };
    return buildFinancialReportPayload({
      sourceTitle: 'Financial Analytics & Cash Flow Report',
      filteredTransactions: scopedTxs,
      allTransactions: transactions,
      budgets,
      goals,
      profile,
      settings,
      isDemoMode,
      filters: {
        rangeLabel: rangeLabels[rangeMode],
        startDate: dateBounds.start || undefined,
        endDate: dateBounds.end || undefined,
      },
      monthlyRows: analytics.monthlyRows.map((r) => ({
        label: r.label,
        income: r.income,
        expense: r.expense,
        net: r.net,
        savingsRate: r.savingsRate,
      })),
      extraMetrics: [
        {
          label: 'Period Income',
          value: formatCurrency(analytics.totalIncome, settings.currency),
          numericValue: analytics.totalIncome,
          isCurrency: true,
          note: 'Filtered inflow',
          tone: 'positive',
        },
        {
          label: 'Period Expenses',
          value: formatCurrency(analytics.totalExpenses, settings.currency),
          numericValue: analytics.totalExpenses,
          isCurrency: true,
          note: 'Filtered outflow',
          tone: 'negative',
        },
        {
          label: 'Net Cash Flow',
          value: formatCurrency(analytics.netCashFlow, settings.currency),
          numericValue: analytics.netCashFlow,
          isCurrency: true,
          note: analytics.netCashFlow >= 0 ? 'Net surplus' : 'Net deficit',
          tone: analytics.netCashFlow >= 0 ? 'positive' : 'negative',
        },
        {
          label: 'Average Daily Spend',
          value: formatCurrency(analytics.avgDailySpend, settings.currency),
          numericValue: analytics.avgDailySpend,
          isCurrency: true,
          note: 'Daily run rate',
          tone: 'neutral',
        },
        {
          label: 'Savings Rate',
          value: `${analytics.savingsRate.toFixed(1)}%`,
          isCurrency: false,
          note: 'Income retained',
          tone: 'accent',
        },
      ],
    });
  }, [
    rangeMode,
    dateBounds,
    scopedTxs,
    transactions,
    budgets,
    goals,
    profile,
    settings,
    isDemoMode,
    analytics,
  ]);

  useEffect(() => {
    if (!downloadingReport || !captureRef.current) return;
    let cancelled = false;

    const runExport = async () => {
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        if (cancelled || !captureRef.current) return;
        const filename = await exportHtmlReportToPdf(
          captureRef.current,
          reportPayload,
          'paisatrack-analytics-report'
        );
        if (!cancelled) {
          showToast('PDF report downloaded', {
            description: `${filename} (${reportPayload.transactions.length} transactions)`,
            variant: 'success',
          });
        }
      } catch (err) {
        if (!cancelled) {
          showToast('Failed to export PDF report', {
            description: err instanceof Error ? err.message : 'Unable to generate report.',
            variant: 'error',
          });
        }
      } finally {
        if (!cancelled) {
          setDownloadingReport(false);
        }
      }
    };

    void runExport();
    return () => {
      cancelled = true;
    };
  }, [downloadingReport, reportPayload, showToast]);

  const handleExportAnalyticsCsv = () => {
    const lines = [
      ['Month', 'Income', 'Expenses', 'NetCashFlow', 'SavingsRatePercent'].join(','),
      ...analytics.monthlyRows.map((r) =>
        [
          escapeCsvCell(r.label),
          r.income.toFixed(2),
          r.expense.toFixed(2),
          r.net.toFixed(2),
          r.savingsRate.toFixed(1),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paisatrack-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Analytics CSV downloaded', { variant: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Range & Export Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438]">
          {(
            [
              { id: '1m', label: 'This Month' },
              { id: '3m', label: 'Last 3 Months' },
              { id: '6m', label: 'Last 6 Months' },
              { id: '1y', label: 'This Year' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRangeMode(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                rangeMode === r.id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {rangeMode === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438]"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438]"
              />
            </div>
          )}
          <button
            type="button"
            disabled={analytics.monthlyRows.length === 0}
            onClick={handleExportAnalyticsCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Preview &amp; Print
          </button>
          <button
            type="button"
            disabled={downloadingReport}
            onClick={() => setDownloadingReport(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5" />
            {downloadingReport ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {/* Key Analytical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Period Income</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-500 tabular-nums">
            {formatCurrency(analytics.totalIncome, settings.currency)}
          </p>
        </div>
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Period Expenses</p>
          <p className="mt-1 font-display text-xl font-bold text-rose-500 tabular-nums">
            {formatCurrency(analytics.totalExpenses, settings.currency)}
          </p>
        </div>
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net Cash Flow</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(analytics.netCashFlow, settings.currency)}
          </p>
        </div>
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Average Daily Spend</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-500 tabular-nums">
            {formatCurrency(analytics.avgDailySpend, settings.currency)}
          </p>
        </div>
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Savings Rate</p>
          <p className="mt-1 font-display text-xl font-bold text-cyan-500 tabular-nums">
            {analytics.savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Cash Flow Composed Chart + Highest Spending Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Cash Flow &amp; Net Trend
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monthly income, expenses, and retained surplus
          </p>

          <div className="mt-5 h-72 w-full">
            {analytics.monthlyRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No transactions recorded in the selected date range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.monthlyRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCurrency(v, settings.currency, { compact: true })}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v), settings.currency)}
                    contentStyle={{
                      backgroundColor: '#101827',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                  />
                  <Bar dataKey="income" name="Income" fill="#8B5CF6" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#06B6D4" radius={[5, 5, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#10B981" strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 flex flex-col">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Highest Spending Categories
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ranked by total outflow in selected period
          </p>

          {analytics.categories.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-10">
              No expense categories to display.
            </div>
          ) : (
            <>
              <div className="h-48 w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.categories.slice(0, 6)}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={86}
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v), settings.currency)}
                      contentStyle={{
                        backgroundColor: '#101827',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#F8FAFC',
                      }}
                    />
                    <Bar dataKey="amount" name="Spent" radius={[0, 6, 6, 0]}>
                      {analytics.categories.slice(0, 6).map((c) => (
                        <Cell key={c.category} fill={c.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-white/10 pt-3">
                {analytics.categories.slice(0, 4).map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300">{c.category}</span>
                    <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(c.amount, settings.currency)} ({c.share.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Spending Trends (Month-over-Month Category Line Chart) */}
      <SpendingTrendsCard transactions={scopedTxs} currency={settings.currency} />

      {/* Month-over-Month Comparison Table */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Month-over-Month Financial Overview
          </h3>
        </div>
        {analytics.monthlyRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Add transactions across months to inspect month-over-month comparisons.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#141d2e] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Income</th>
                  <th className="py-3 px-4 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Expense MoM</th>
                  <th className="py-3 px-4 text-right">Net Cash Flow</th>
                  <th className="py-3 px-4 text-right">Savings Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono tabular-nums">
                {analytics.monthlyRows.map((row) => (
                  <tr key={row.monthKey} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-white">
                      {row.label}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(row.income, settings.currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800 dark:text-slate-200">
                      {formatCurrency(row.expense, settings.currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.momExpenseChange === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={
                            row.momExpenseChange <= 0 ? 'text-emerald-500' : 'text-amber-500'
                          }
                        >
                          {row.momExpenseChange > 0 ? '+' : ''}
                          {row.momExpenseChange.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(row.net, settings.currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-600 dark:text-cyan-400">
                      {row.savingsRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportPreviewModal
        open={reportOpen}
        payload={reportOpen ? reportPayload : null}
        onClose={() => setReportOpen(false)}
      />

      {downloadingReport && (
        <PdfCaptureTemplate
          ref={captureRef}
          payload={reportPayload}
          sections={ANALYTICS_REPORT_SECTIONS}
        />
      )}
    </div>
  );
}
