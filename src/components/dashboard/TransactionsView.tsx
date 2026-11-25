import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  Download,
  FileText,
  Pencil,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { useToast } from '../../context/ToastContext';
import {
  PAYMENT_METHODS,
  TRANSACTION_CATEGORIES,
  type PaymentMethod,
  type TransactionCategory,
  type TransactionRecord,
  type TransactionType,
} from '../../types/finance';
import {
  escapeCsvCell,
  formatCurrency,
  formatDateStr,
  parseCsvLines,
} from '../../lib/formatters';
import { buildFinancialReportPayload } from '../../lib/pdfReport';
import { suggestTransactionCategory } from '../../lib/categoryEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ReportPreviewModal } from './ReportPreviewModal';
import { TransactionModal } from './TransactionModal';

export function TransactionsView() {
  const { isDemoMode } = useAuth();
  const {
    transactions,
    budgets,
    goals,
    profile,
    settings,
    deleteTransaction,
    importTransactionsBatch,
  } = useFinance();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TransactionCategory>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>(
    'date_desc'
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [csvPreviewRows, setCsvPreviewRows] = useState<
    Array<{
      title: string;
      amount: number;
      type: TransactionType;
      category: TransactionCategory;
      date: string;
      paymentMethod: PaymentMethod;
      notes?: string;
      autoTagged?: boolean;
    }> | null
  >(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (paymentFilter !== 'all' && t.paymentMethod !== paymentFilter) return false;
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        if (q) {
          const hay = `${t.title} ${t.category} ${t.paymentMethod} ${t.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
        if (sortBy === 'date_asc') return a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
        if (sortBy === 'amount_desc') return b.amount - a.amount;
        return a.amount - b.amount;
      });
  }, [transactions, search, typeFilter, categoryFilter, paymentFilter, startDate, endDate, sortBy]);

  const summary = useMemo(() => {
    const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const reportPayload = useMemo(() => {
    if (!reportOpen) return null;
    const sortLabels: Record<typeof sortBy, string> = {
      date_desc: 'Newest First',
      date_asc: 'Oldest First',
      amount_desc: 'Highest Amount',
      amount_asc: 'Lowest Amount',
    };
    return buildFinancialReportPayload({
      sourceTitle: 'Filtered Transactions & Insights Report',
      filteredTransactions: filtered,
      allTransactions: transactions,
      budgets,
      goals,
      profile,
      settings,
      isDemoMode,
      filters: {
        rangeLabel: startDate || endDate ? 'Custom Date Filter' : 'All Recorded Dates',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchQuery: search.trim() || undefined,
        typeFilter,
        categoryFilter,
        paymentFilter,
        sortLabel: sortLabels[sortBy],
      },
    });
  }, [
    reportOpen,
    filtered,
    transactions,
    budgets,
    goals,
    profile,
    settings,
    isDemoMode,
    startDate,
    endDate,
    search,
    typeFilter,
    categoryFilter,
    paymentFilter,
    sortBy,
  ]);

  const handleExportCsv = () => {
    const headers = ['Title', 'Amount', 'Type', 'Category', 'Date', 'PaymentMethod', 'Notes'];
    const lines = [
      headers.join(','),
      ...filtered.map((t) =>
        [
          escapeCsvCell(t.title),
          escapeCsvCell(t.amount),
          escapeCsvCell(t.type),
          escapeCsvCell(t.category),
          escapeCsvCell(t.date),
          escapeCsvCell(t.paymentMethod),
          escapeCsvCell(t.notes || ''),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paisatrack-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', { description: `${filtered.length} transactions downloaded`, variant: 'success' });
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvLines(text);
    if (rows.length < 2) {
      showToast('CSV file is empty or missing rows', { variant: 'error' });
      e.target.value = '';
      return;
    }

    const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
    const findIdx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

    const titleIdx = findIdx(['title', 'description', 'name', 'merchant']);
    const amountIdx = findIdx(['amount', 'value', 'sum']);
    const typeIdx = findIdx(['type']);
    const catIdx = findIdx(['category']);
    const dateIdx = findIdx(['date']);
    const pmIdx = findIdx(['payment', 'method']);
    const notesIdx = findIdx(['note', 'memo']);

    const parsed = rows
      .slice(1)
      .map((cols) => {
        const rawTitle = cols[titleIdx >= 0 ? titleIdx : 0] || 'Imported Entry';
        const rawAmt = Number((cols[amountIdx >= 0 ? amountIdx : 1] || '0').replace(/[^0-9.-]/g, ''));
        const rawType = (cols[typeIdx >= 0 ? typeIdx : 2] || '').toLowerCase();
        const inferredType: TransactionType =
          rawType === 'income' || rawAmt < 0 === false && rawType.includes('credit')
            ? 'income'
            : 'expense';
        const absAmt = Math.abs(rawAmt);
        const finalType: TransactionType =
          rawType === 'income' ? 'income' : rawType === 'expense' ? 'expense' : inferredType;
        const rawCat = (catIdx >= 0 ? cols[catIdx] : '')?.trim() || '';
        const explicitValidCat = (TRANSACTION_CATEGORIES as readonly string[]).includes(rawCat)
          ? (rawCat as TransactionCategory)
          : null;
        const rawDate = cols[dateIdx >= 0 ? dateIdx : 4] || new Date().toISOString().slice(0, 10);
        const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
          ? rawDate
          : new Date().toISOString().slice(0, 10);
        const rawPm = cols[pmIdx >= 0 ? pmIdx : 5] || 'Other';
        const pm = (PAYMENT_METHODS as readonly string[]).includes(rawPm)
          ? (rawPm as PaymentMethod)
          : 'Other';
        const notes = notesIdx >= 0 ? cols[notesIdx] : '';

        let resolvedCategory: TransactionCategory = explicitValidCat || 'Other';
        let autoTagged = false;
        if (!explicitValidCat || explicitValidCat === 'Other') {
          const heuristic = suggestTransactionCategory({
            title: rawTitle,
            notes,
            type: finalType,
            amount: absAmt,
            paymentMethod: pm,
            history: transactions,
          });
          if (heuristic.top && heuristic.top.confidence >= 45) {
            resolvedCategory = heuristic.top.category;
            autoTagged = true;
          }
        }

        return {
          title: rawTitle,
          amount: absAmt,
          type: finalType,
          category: resolvedCategory,
          date: dateIso,
          paymentMethod: pm,
          notes,
          autoTagged,
        };
      })
      .filter((r) => r.title && Number.isFinite(r.amount) && r.amount > 0);

    if (parsed.length === 0) {
      showToast('No valid transactions found in CSV', {
        description: 'Expected columns: Title, Amount, Type, Category, Date, PaymentMethod',
        variant: 'error',
      });
    } else {
      setCsvPreviewRows(parsed);
    }
    e.target.value = '';
  };

  const confirmImportCsv = async () => {
    if (!csvPreviewRows) return;
    setImportingCsv(true);
    try {
      const payload = csvPreviewRows.map(({ autoTagged: _ignored, ...rest }) => rest);
      const count = await importTransactionsBatch(payload);
      showToast('CSV imported successfully', {
        description: `${count} transactions added.`,
        variant: 'success',
      });
      setCsvPreviewRows(null);
    } catch (err) {
      showToast('Import failed', {
        description: err instanceof Error ? err.message : 'Unable to import CSV rows.',
        variant: 'error',
      });
    } finally {
      setImportingCsv(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Filtered Income</span>
            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(summary.income, settings.currency)}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Filtered Expenses</span>
            <p className="font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatCurrency(summary.expense, settings.currency)}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Net Cash Flow</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(summary.net, settings.currency)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileSelected(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, category, notes..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionType)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Types</option>
          <option value="income">Income Only</option>
          <option value="expense">Expenses Only</option>
        </select>

        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | TransactionCategory)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Categories</option>
          {TRANSACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by payment method"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentMethod)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Payment Methods</option>
          {PAYMENT_METHODS.map((pm) => (
            <option key={pm} value={pm}>
              {pm}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            aria-label="Sort transactions"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc')
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Date range:</span>
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-800 dark:text-slate-200"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-800 dark:text-slate-200"
            />
          </div>
          {(search || typeFilter !== 'all' || categoryFilter !== 'all' || paymentFilter !== 'all' || startDate || endDate) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* CSV Preview Drawer */}
      {csvPreviewRows && (
        <div className="rounded-[18px] border border-cyan-500/40 bg-white dark:bg-[#192438] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                CSV Import Preview ({csvPreviewRows.length} valid rows detected)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review sample rows before saving them to your ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCsvPreviewRows(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-48 overflow-auto border border-slate-200 dark:border-white/10 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-[#101827] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {csvPreviewRows.slice(0, 6).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{r.title}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        {r.category}
                        {r.autoTagged && (
                          <span
                            title="Auto-tagged from historical patterns"
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-500"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            Auto
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.date}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.paymentMethod}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.type === 'income' ? '+' : '-'}
                      {formatCurrency(r.amount, settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCsvPreviewRows(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importingCsv}
              onClick={() => void confirmImportCsv()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-60"
            >
              {importingCsv ? 'Importing...' : `Import ${csvPreviewRows.length} Transactions`}
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {transactions.length === 0 ? 'No transactions recorded yet' : 'No matching transactions'}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {transactions.length === 0
                ? 'Log your first income or expense, or import a CSV statement.'
                : 'Try adjusting your search query or filters.'}
            </p>
            {transactions.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingTx(null);
                  setModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add First Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#141d2e] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Transaction</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            tx.type === 'income'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-rose-500/15 text-rose-500'
                          }`}
                        >
                          {tx.type === 'income' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">
                              {tx.title}
                            </p>
                            {tx.recurringId && (
                              <span
                                title="Auto-posted by Recurring Schedule"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 shrink-0"
                              >
                                <Repeat className="w-3 h-3" />
                                Auto
                              </span>
                            )}
                          </div>
                          {tx.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                              {tx.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {tx.category}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateStr(tx.date, settings.dateFormat)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {tx.paymentMethod}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, settings.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTx(tx);
                          setModalOpen(true);
                        }}
                        aria-label={`Edit ${tx.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-500/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        aria-label={`Delete ${tx.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        editingTx={editingTx}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Transaction"
        description={`Are you sure you want to permanently remove "${deleteTarget?.title || ''}"? Dashboard totals and budgets will recalculate immediately.`}
        confirmLabel="Delete Transaction"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteTransaction(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />

      <ReportPreviewModal
        open={reportOpen}
        payload={reportPayload}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
