import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Printer, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateStr } from '../../lib/formatters';
import {
  exportFinancialReportPdf,
  exportHtmlReportToPdf,
  type FinancialReportPayload,
  type ReportSectionSelection,
} from '../../lib/pdfReport';
import { PdfCaptureTemplate } from './PdfCaptureTemplate';

interface ReportPreviewModalProps {
  open: boolean;
  payload: FinancialReportPayload | null;
  onClose: () => void;
}

export function ReportPreviewModal({ open, payload, onClose }: ReportPreviewModalProps) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<ReportSectionSelection>({
    includeInsights: true,
    includeCategories: true,
    includeMonthlyTrend: true,
    includeBudgets: true,
    includeGoals: true,
    includeTransactions: true,
  });

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('paisatrack-printing-modal');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('paisatrack-printing-modal');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!exporting || !open || !payload || !captureRef.current) return;
    let cancelled = false;

    const runExport = async () => {
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        if (cancelled || !captureRef.current) return;
        const filename = await exportHtmlReportToPdf(
          captureRef.current,
          payload,
          'paisatrack-report'
        );
        if (!cancelled) {
          showToast('PDF report downloaded', {
            description: `${filename} (${payload.transactions.length} transactions)`,
            variant: 'success',
          });
        }
      } catch {
        if (!cancelled) {
          try {
            const filename = exportFinancialReportPdf(payload, sections);
            showToast('PDF report downloaded', {
              description: `${filename} (${payload.transactions.length} transactions)`,
              variant: 'success',
            });
          } catch (fallbackErr) {
            showToast('Failed to generate PDF', {
              description:
                fallbackErr instanceof Error ? fallbackErr.message : 'Unable to export report.',
              variant: 'error',
            });
          }
        }
      } finally {
        if (!cancelled) {
          setExporting(false);
        }
      }
    };

    void runExport();
    return () => {
      cancelled = true;
    };
  }, [exporting, open, payload, sections, showToast]);

  if (!open || !payload) return null;

  const toggleSection = (key: keyof ReportSectionSelection) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadPdf = () => {
    if (exporting) return;
    setExporting(true);
  };

  const activeFilterParts: string[] = [`Range: ${payload.filters.rangeLabel}`];
  if (payload.filters.startDate || payload.filters.endDate) {
    const startText = payload.filters.startDate
      ? formatDateStr(payload.filters.startDate, payload.dateFormat)
      : 'Earliest';
    const endText = payload.filters.endDate
      ? formatDateStr(payload.filters.endDate, payload.dateFormat)
      : 'Latest';
    activeFilterParts.push(`Dates: ${startText} – ${endText}`);
  }
  if (payload.filters.typeFilter && payload.filters.typeFilter !== 'all') {
    activeFilterParts.push(`Type: ${payload.filters.typeFilter}`);
  }
  if (payload.filters.categoryFilter && payload.filters.categoryFilter !== 'all') {
    activeFilterParts.push(`Category: ${payload.filters.categoryFilter}`);
  }
  if (payload.filters.paymentFilter && payload.filters.paymentFilter !== 'all') {
    activeFilterParts.push(`Method: ${payload.filters.paymentFilter}`);
  }
  if (payload.filters.searchQuery) {
    activeFilterParts.push(`Search: "${payload.filters.searchQuery}"`);
  }
  if (payload.filters.sortLabel) {
    activeFilterParts.push(`Sort: ${payload.filters.sortLabel}`);
  }

  const sectionControls: Array<{
    key: keyof ReportSectionSelection;
    label: string;
    available: boolean;
  }> = [
    { key: 'includeInsights', label: 'Insights', available: payload.insights.length > 0 },
    { key: 'includeCategories', label: 'Categories', available: payload.categories.length > 0 },
    { key: 'includeMonthlyTrend', label: 'Monthly Trend', available: payload.monthlyRows.length > 0 },
    { key: 'includeBudgets', label: 'Budgets', available: payload.budgets.length > 0 },
    { key: 'includeGoals', label: 'Goals', available: payload.goals.length > 0 },
    { key: 'includeTransactions', label: 'Transactions', available: true },
  ];

  const modalContent = (
    <div
      id="paisatrack-report-portal"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Interactive Modal Header & Section Controls (hidden when printing) */}
      <div className="report-modal-chrome w-full max-w-5xl rounded-t-2xl border border-b-0 border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] px-5 py-4 flex flex-col gap-3 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="report-preview-title"
                className="font-display text-base font-bold text-slate-900 dark:text-white truncate"
              >
                Printable Financial Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {payload.transactions.length} matching transactions · {payload.currency} · {payload.filters.rangeLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#101827] hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report preview"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Inclusion Toggles */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-white/10 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Include sections:</span>
          {sectionControls
            .filter((s) => s.available)
            .map((item) => (
              <label
                key={item.key}
                className="inline-flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={sections[item.key]}
                  onChange={() => toggleSection(item.key)}
                  className="rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500"
                />
                <span>{item.label}</span>
              </label>
            ))}
        </div>
      </div>

      {/* Crisp White Paper Preview Sheet (also used directly for @media print) */}
      <div className="report-paper-sheet w-full max-w-5xl rounded-b-2xl border border-slate-200 dark:border-white/10 bg-white text-slate-900 shadow-2xl overflow-hidden">
        {/* Executive Brand Banner */}
        <div className="bg-[#101827] text-white px-7 py-6 border-b-4 border-violet-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center font-display font-bold text-xs text-white">
                P
              </div>
              <span className="font-display text-xl font-bold tracking-tight">PaisaTrack</span>
            </div>
            <p className="mt-1 text-xs text-violet-200/90">
              Your Money. Your Goals. Your Future.
            </p>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-base font-bold text-white">{payload.sourceTitle}</p>
            <p className="mt-0.5 text-xs text-slate-300">
              Generated {payload.generatedAtDisplay}
            </p>
          </div>
        </div>

        <div className="p-7 sm:p-8 space-y-7">
          {/* Account & Active Filters Strip */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                {payload.accountName}
                {payload.accountEmail ? ` · ${payload.accountEmail}` : ''}
              </p>
              <p className="text-slate-600 font-medium tabular-nums">
                Currency: {payload.currency} · {payload.transactions.length} matching records
              </p>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {activeFilterParts.join(' · ')}
            </p>
          </div>

          {/* Executive KPI Grid */}
          <section className="break-inside-avoid">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {payload.metrics.slice(0, 5).map((m) => {
                const toneClass =
                  m.tone === 'positive'
                    ? 'text-emerald-700'
                    : m.tone === 'negative'
                    ? 'text-rose-700'
                    : m.tone === 'accent'
                    ? 'text-violet-700'
                    : 'text-slate-900';
                return (
                  <div
                    key={m.label}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
                  >
                    <p className="text-[11px] font-medium text-slate-500">{m.label}</p>
                    <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${toneClass}`}>
                      {m.value}
                    </p>
                    {m.note && <p className="mt-0.5 text-[11px] text-slate-500">{m.note}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Financial Insights */}
          {sections.includeInsights && payload.insights.length > 0 && (
            <section className="break-inside-avoid space-y-2.5">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Executive Financial Insights
                </h3>
                <span className="text-[11px] text-slate-500">Computed from filtered dataset</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed list-disc pl-5 marker:text-violet-600">
                {payload.insights.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Category Breakdown */}
          {sections.includeCategories && payload.categories.length > 0 && (
            <section className="break-inside-avoid space-y-3">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Expense Category Breakdown
                </h3>
                <span className="text-[11px] text-slate-500">
                  {payload.categories.length} active categories
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3.5 font-semibold">Category</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Entries</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Share</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payload.categories.map((cat) => (
                      <tr key={cat.category}>
                        <td className="py-2.5 px-3.5 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-600">
                          {cat.txCount}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-600">
                          {cat.sharePercent.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {formatCurrency(cat.amount, payload.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Monthly Cash Flow Trend */}
          {sections.includeMonthlyTrend && payload.monthlyRows.length > 0 && (
            <section className="break-inside-avoid space-y-3">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Monthly Cash Flow Summary
                </h3>
                <span className="text-[11px] text-slate-500">
                  {payload.monthlyRows.length} month(s)
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3.5 font-semibold">Month</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Income</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Expenses</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Net Cash Flow</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Savings Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {payload.monthlyRows.map((row) => (
                      <tr key={row.label}>
                        <td className="py-2.5 px-3.5 font-sans font-semibold text-slate-900">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-emerald-700">
                          {formatCurrency(row.income, payload.currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-800">
                          {formatCurrency(row.expense, payload.currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900">
                          {formatCurrency(row.net, payload.currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-violet-700">
                          {row.savingsRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Budget Utilization */}
          {sections.includeBudgets && payload.budgets.length > 0 && (
            <section className="break-inside-avoid space-y-3">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Budget Utilization
                </h3>
                <span className="text-[11px] text-slate-500">
                  {payload.budgets.length} tracked limits
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3.5 font-semibold">Category</th>
                      <th className="py-2.5 px-3.5 font-semibold">Month</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Spent</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Limit</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Remaining</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payload.budgets.map((b) => {
                      const statusColor =
                        b.pct >= 100
                          ? 'text-rose-700 font-semibold'
                          : b.pct >= 75
                          ? 'text-amber-700 font-semibold'
                          : 'text-emerald-700 font-medium';
                      return (
                        <tr key={`${b.category}-${b.month}`}>
                          <td className="py-2.5 px-3.5 font-medium text-slate-900">{b.category}</td>
                          <td className="py-2.5 px-3.5 text-slate-600 font-mono">{b.month}</td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-900">
                            {formatCurrency(b.spent, payload.currency)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-600">
                            {formatCurrency(b.limit, payload.currency)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-800">
                            {formatCurrency(b.remaining, payload.currency)}
                          </td>
                          <td className={`py-2.5 px-3.5 text-right ${statusColor}`}>
                            {b.pct}% · {b.statusLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Savings Goals */}
          {sections.includeGoals && payload.goals.length > 0 && (
            <section className="break-inside-avoid space-y-3">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Savings Goals Progress
                </h3>
                <span className="text-[11px] text-slate-500">
                  {payload.goals.length} active goals
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3.5 font-semibold">Goal</th>
                      <th className="py-2.5 px-3.5 font-semibold">Category</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Saved</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Target</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Funded</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Target Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payload.goals.map((g) => (
                      <tr key={g.title}>
                        <td className="py-2.5 px-3.5 font-medium text-slate-900">{g.title}</td>
                        <td className="py-2.5 px-3.5 text-slate-600">{g.category}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {formatCurrency(g.currentAmount, payload.currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700">
                          {formatCurrency(g.targetAmount, payload.currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-violet-700 font-semibold">
                          {g.pct}%
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600 whitespace-nowrap">
                          {formatDateStr(g.targetDate, payload.dateFormat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Filtered Transaction Ledger */}
          {sections.includeTransactions && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Filtered Transaction Ledger
                </h3>
                <span className="text-[11px] text-slate-500">
                  {payload.transactions.length} matching transactions
                </span>
              </div>

              {payload.transactions.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No transactions matched the active filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#101827] text-white">
                        <th className="py-2.5 px-3 font-semibold">Date</th>
                        <th className="py-2.5 px-3 font-semibold">Transaction</th>
                        <th className="py-2.5 px-3 font-semibold">Category</th>
                        <th className="py-2.5 px-3 font-semibold">Method</th>
                        <th className="py-2.5 px-3 font-semibold">Type</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payload.transactions.map((tx) => (
                        <tr key={tx.id} className="even:bg-slate-50/70">
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {formatDateStr(tx.date, payload.dateFormat)}
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900">{tx.title}</p>
                            {tx.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{tx.notes}</p>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{tx.category}</td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {tx.paymentMethod}
                          </td>
                          <td className="py-2 px-3 text-slate-600 capitalize whitespace-nowrap">
                            {tx.type}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                              tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCurrency(tx.amount, payload.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t border-slate-200 font-semibold">
                        <td colSpan={4} className="py-2.5 px-3 text-slate-700">
                          Net Cash Flow ({payload.transactions.length} entries)
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">Net</td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                            payload.kpisRaw.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatCurrency(payload.kpisRaw.netCashFlow, payload.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Document Footer */}
          <footer className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              {payload.isDemoMode
                ? `PaisaTrack Financial Report · ${payload.accountName}`
                : 'PaisaTrack Personal Finance Report · Confidential Statement'}
            </span>
            <span>All figures in {payload.currency}</span>
          </footer>
        </div>
      </div>

      {exporting && <PdfCaptureTemplate ref={captureRef} payload={payload} sections={sections} />}
    </div>
  );

  return createPortal(modalContent, document.body);
}
