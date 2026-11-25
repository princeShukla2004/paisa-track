import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type {
  RecurringFrequency,
  RecurringTransactionRecord,
  TransactionType,
} from '../../types/finance';
import { formatCurrency, formatDateStr, toIsoDate } from '../../lib/formatters';
import { RECURRING_FREQUENCY_LABELS, toMonthlyEquivalent } from '../../lib/recurringSchedule';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RecurringTransactionModal } from './RecurringTransactionModal';

type StatusFilter = 'all' | 'active' | 'paused' | TransactionType;

export function RecurringTransactionsView() {
  const {
    recurringTransactions,
    settings,
    toggleRecurringTransaction,
    deleteRecurringTransaction,
    triggerRecurringNow,
    processDueRecurringTransactions,
  } = useFinance();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | RecurringFrequency>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringTransactionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringTransactionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [checkingDue, setCheckingDue] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const todayIso = toIsoDate(new Date());

  const stats = useMemo(() => {
    const activeRules = recurringTransactions.filter((r) => r.active);
    const monthlyIncome = activeRules
      .filter((r) => r.type === 'income')
      .reduce((sum, r) => sum + toMonthlyEquivalent(r.amount, r.frequency), 0);
    const monthlyExpense = activeRules
      .filter((r) => r.type === 'expense')
      .reduce((sum, r) => sum + toMonthlyEquivalent(r.amount, r.frequency), 0);
    const dueNowCount = activeRules.filter((r) => r.nextDueDate <= todayIso).length;
    const nextUpcoming = [...activeRules].sort((a, b) =>
      a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : 0
    )[0];

    return {
      activeCount: activeRules.length,
      totalCount: recurringTransactions.length,
      monthlyIncome,
      monthlyExpense,
      monthlyNet: monthlyIncome - monthlyExpense,
      dueNowCount,
      nextUpcoming,
    };
  }, [recurringTransactions, todayIso]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recurringTransactions.filter((rec) => {
      if (filter === 'active' && !rec.active) return false;
      if (filter === 'paused' && rec.active) return false;
      if (filter === 'income' && rec.type !== 'income') return false;
      if (filter === 'expense' && rec.type !== 'expense') return false;
      if (frequencyFilter !== 'all' && rec.frequency !== frequencyFilter) return false;
      if (q) {
        const hay = `${rec.title} ${rec.category} ${rec.paymentMethod} ${rec.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recurringTransactions, filter, frequencyFilter, search]);

  const handleRunDueCheck = async () => {
    setCheckingDue(true);
    try {
      await processDueRecurringTransactions(false);
    } finally {
      setCheckingDue(false);
    }
  };

  const handleToggle = async (rec: RecurringTransactionRecord) => {
    setBusyId(rec.id);
    try {
      await toggleRecurringTransaction(rec.id, !rec.active);
    } finally {
      setBusyId(null);
    }
  };

  const handlePostNow = async (rec: RecurringTransactionRecord) => {
    setBusyId(rec.id);
    try {
      await triggerRecurringNow(rec.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Est. Monthly Income
            </span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(stats.monthlyIncome, settings.currency)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Normalized across active schedules
          </p>
        </div>

        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Est. Monthly Expenses
            </span>
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {formatCurrency(stats.monthlyExpense, settings.currency)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Rent, bills &amp; recurring subscriptions
          </p>
        </div>

        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Net Automated / Mo
            </span>
            <Repeat className="w-4 h-4 text-violet-500" />
          </div>
          <p
            className={`mt-2 font-mono text-xl font-bold tabular-nums ${
              stats.monthlyNet >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {stats.monthlyNet >= 0 ? '+' : ''}
            {formatCurrency(stats.monthlyNet, settings.currency)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.activeCount} active of {stats.totalCount} total rules
          </p>
        </div>

        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Next Scheduled Run
            </span>
            <CalendarClock className="w-4 h-4 text-cyan-500" />
          </div>
          {stats.nextUpcoming ? (
            <>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white truncate">
                {stats.nextUpcoming.title}
              </p>
              <p className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
                {stats.nextUpcoming.nextDueDate <= todayIso
                  ? 'Due today / pending sync'
                  : formatDateStr(stats.nextUpcoming.nextDueDate, settings.dateFormat)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                No active rules
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Add a schedule to automate entries
              </p>
            </>
          )}
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schedules..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>

          <select
            aria-label="Filter recurring schedules"
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused Only</option>
            <option value="income">Income Rules</option>
            <option value="expense">Expense Rules</option>
          </select>

          <select
            aria-label="Filter by frequency"
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value as 'all' | RecurringFrequency)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Frequencies</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={checkingDue}
            onClick={() => void handleRunDueCheck()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingDue ? 'animate-spin' : ''}`} />
            {checkingDue
              ? 'Checking...'
              : stats.dueNowCount > 0
              ? `Run Due Check (${stats.dueNowCount})`
              : 'Check Due Now'}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingRule(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      {/* Recurring Rules Table / Empty State */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-600/15 text-violet-500 flex items-center justify-center mb-3">
              <Repeat className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {recurringTransactions.length === 0
                ? 'No recurring schedules configured yet'
                : 'No recurring schedules match your filters'}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {recurringTransactions.length === 0
                ? 'Automate monthly salary, apartment rent, utility bills, or subscriptions. Due entries post into your ledger automatically.'
                : 'Adjust your search or status filter to view other scheduled rules.'}
            </p>
            {recurringTransactions.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingRule(null);
                  setModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create First Schedule
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#141d2e] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Next Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                {filtered.map((rec) => {
                  const isDue = rec.active && rec.nextDueDate <= todayIso;
                  const isRowBusy = busyId === rec.id;
                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02] ${
                        !rec.active ? 'opacity-70' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              rec.type === 'income'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-rose-500/15 text-rose-500'
                            }`}
                          >
                            {rec.type === 'income' ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[230px]">
                              {rec.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                              {rec.category} · {rec.paymentMethod}
                              {rec.notes ? ` · ${rec.notes}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {RECURRING_FREQUENCY_LABELS[rec.frequency]}
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <p
                          className={`font-medium ${
                            isDue
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {formatDateStr(rec.nextDueDate, settings.dateFormat)}
                        </p>
                        {rec.lastRunDate && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Last posted {formatDateStr(rec.lastRunDate, settings.dateFormat)}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => void handleToggle(rec)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            rec.active
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                              : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-white/15'
                          }`}
                        >
                          {rec.active ? (
                            <>
                              <Pause className="w-3 h-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              Paused
                            </>
                          )}
                        </button>
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                          rec.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {rec.type === 'income' ? '+' : '-'}
                        {formatCurrency(rec.amount, settings.currency)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => void handlePostNow(rec)}
                          title="Post one entry into Transactions now"
                          aria-label={`Post ${rec.title} now`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10 transition-colors"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRule(rec);
                            setModalOpen(true);
                          }}
                          aria-label={`Edit ${rec.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-500/10 transition-colors ml-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rec)}
                          aria-label={`Delete ${rec.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecurringTransactionModal
        open={modalOpen}
        editingRule={editingRule}
        onClose={() => {
          setModalOpen(false);
          setEditingRule(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Recurring Schedule"
        description={`Remove "${deleteTarget?.title || ''}"? Future automated entries will stop, while already-posted transactions remain in your ledger.`}
        confirmLabel="Delete Schedule"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteRecurringTransaction(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
