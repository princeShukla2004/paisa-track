import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  BUDGET_CATEGORIES,
  FIELD_LIMITS,
  type BudgetCategory,
  type BudgetRecord,
} from '../../types/finance';
import { formatCurrency, getMonthLabel } from '../../lib/formatters';
import { BUDGET_THRESHOLDS } from '../../lib/budgetAlerts';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function BudgetsView() {
  const { budgets, transactions, settings, addBudget, updateBudget, deleteBudget } = useFinance();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRecord | null>(null);
  const [category, setCategory] = useState<BudgetCategory>('Food');
  const [limit, setLimit] = useState('');
  const [month, setMonth] = useState(selectedMonth);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BudgetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const budgetStats = useMemo(() => {
    const monthBudgets = budgets.filter((b) => b.month === selectedMonth);
    const items = monthBudgets.map((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(b.month))
        .reduce((s, t) => s + t.amount, 0);
      const remaining = b.limit - spent;
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return { budget: b, spent, remaining, pct };
    });

    const totalLimit = items.reduce((s, it) => s + it.budget.limit, 0);
    const totalSpent = items.reduce((s, it) => s + it.spent, 0);
    return {
      items,
      totalLimit,
      totalSpent,
      totalRemaining: totalLimit - totalSpent,
      overallPct: totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0,
    };
  }, [budgets, transactions, selectedMonth]);

  const openCreateModal = () => {
    setEditingBudget(null);
    setCategory('Food');
    setLimit('');
    setMonth(selectedMonth);
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (b: BudgetRecord) => {
    setEditingBudget(b);
    setCategory(b.category);
    setLimit(String(b.limit));
    setMonth(b.month);
    setNotes(b.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const numLimit = Number(limit);
    if (!Number.isFinite(numLimit) || numLimit <= 0) {
      setFormError('Monthly limit must be greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setFormError('Please select a valid month.');
      return;
    }
    setSaving(true);
    try {
      const payload = { category, limit: numLimit, month, notes: notes.trim() };
      if (editingBudget) {
        await updateBudget(editingBudget.id, payload);
      } else {
        await addBudget(payload);
      }
      setSelectedMonth(month);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const getAlertStatus = (pct: number) => {
    if (pct >= 100) {
      return {
        label: '100% Exceeded',
        colorClass: 'text-rose-600 dark:text-rose-400',
        barClass: 'bg-rose-500',
        icon: AlertTriangle,
      };
    }
    if (pct >= 90) {
      return {
        label: '90% Threshold Reached',
        colorClass: 'text-amber-600 dark:text-amber-400',
        barClass: 'bg-amber-500',
        icon: AlertTriangle,
      };
    }
    if (pct >= 75) {
      return {
        label: '75% Utilized',
        colorClass: 'text-amber-500 dark:text-amber-300',
        barClass: 'bg-amber-400',
        icon: AlertTriangle,
      };
    }
    if (pct >= 50) {
      return {
        label: '50% Utilized',
        colorClass: 'text-cyan-600 dark:text-cyan-400',
        barClass: 'bg-cyan-500',
        icon: CheckCircle2,
      };
    }
    return {
      label: 'On Track',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      barClass: 'bg-emerald-500',
      icon: CheckCircle2,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header Summary & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="budget-month-picker" className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Budget Month:
          </label>
          <input
            id="budget-month-picker"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-xs font-semibold text-slate-900 dark:text-white"
          />
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Monthly Budget
        </button>
      </div>

      {/* Aggregate Budget Summary Card */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total Budgeted ({getMonthLabel(selectedMonth)})
            </p>
            <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(budgetStats.totalLimit, settings.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Actual Spent</p>
            <p className="mt-1 font-display text-xl font-bold text-amber-500 tabular-nums">
              {formatCurrency(budgetStats.totalSpent, settings.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Remaining Budget</p>
            <p
              className={`mt-1 font-display text-xl font-bold tabular-nums ${
                budgetStats.totalRemaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-500'
              }`}
            >
              {formatCurrency(budgetStats.totalRemaining, settings.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Overall Utilization</p>
            <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {budgetStats.overallPct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Active Threshold Alerts Summary */}
      {(() => {
        const triggered = budgetStats.items
          .filter((it) => it.pct >= 50)
          .sort((a, b) => b.pct - a.pct);
        if (triggered.length === 0) return null;
        return (
          <div className="rounded-[18px] border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {triggered.length} Category {triggered.length === 1 ? 'Budget' : 'Budgets'} Reached Alert Thresholds
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                  {triggered
                    .map((it) => `${it.budget.category} (${Math.round(it.pct)}%)`)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
              {settings.budgetAlertsEnabled ? 'Live toast alerts active (50%, 75%, 90%, 100%)' : 'Toast alerts paused in Settings'}
            </span>
          </div>
        );
      })()}

      {/* Category Budgets Grid */}
      {budgetStats.items.length === 0 ? (
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-12 text-center">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No budgets set for {getMonthLabel(selectedMonth)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Create category spending limits (Food, Shopping, Transport, Bills, etc.) to monitor live consumption and receive 50%, 75%, 90%, and 100% alerts.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Set First Category Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetStats.items.map(({ budget, spent, remaining, pct }) => {
            const alert = getAlertStatus(pct);
            const StatusIcon = alert.icon;
            return (
              <div
                key={budget.id}
                className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {budget.category}
                      </h3>
                      <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${alert.colorClass}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {alert.label} ({pct.toFixed(0)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(budget)}
                        aria-label={`Edit ${budget.category} budget`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-500/10"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(budget)}
                        aria-label={`Delete ${budget.category} budget`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#101827] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, pct)}%` }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${alert.barClass}`}
                    />
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono tabular-nums">
                    {BUDGET_THRESHOLDS.map((level) => {
                      const reached = pct >= level;
                      const activeColor =
                        level === 100
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : level >= 75
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-cyan-600 dark:text-cyan-400 font-semibold';
                      return (
                        <span
                          key={level}
                          className={reached ? activeColor : 'text-slate-400 dark:text-slate-500'}
                        >
                          {reached ? '● ' : '○ '}
                          {level}%
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Spent:{' '}
                    <strong className="font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(spent, settings.currency)}
                    </strong>{' '}
                    of{' '}
                    <span className="font-mono tabular-nums">
                      {formatCurrency(budget.limit, settings.currency)}
                    </span>
                  </span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                    }`}
                  >
                    {remaining >= 0
                      ? `${formatCurrency(remaining, settings.currency)} left`
                      : `${formatCurrency(Math.abs(remaining), settings.currency)} over`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Budget Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative z-10 w-full max-w-md rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {editingBudget ? 'Edit Category Budget' : 'New Monthly Budget'}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BudgetCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Monthly Limit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={FIELD_LIMITS.AMOUNT_MAX}
                      required
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="12000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Month
                    </label>
                    <input
                      type="month"
                      required
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.BUDGET_NOTES_MAX}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional spending guideline"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : editingBudget ? 'Update Budget' : 'Save Budget'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Budget"
        description={`Remove the ${deleteTarget?.category || ''} budget for ${deleteTarget?.month || ''}? Your underlying transactions will not be deleted.`}
        confirmLabel="Delete Budget"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteBudget(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
