import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Pencil,
  PiggyBank,
  Plus,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { FIELD_LIMITS, type SavingsGoalRecord } from '../../types/finance';
import {
  calculateMonthsRemaining,
  formatCurrency,
  formatDateStr,
  toIsoDate,
} from '../../lib/formatters';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const GOAL_TEMPLATES = [
  'Emergency Fund',
  'Buy a Laptop',
  'New Car',
  'Vacation',
  'Higher Education',
  'Home Down Payment',
];

function CircularProgress({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-200 dark:text-[#101827]"
        />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={clamped >= 100 ? '#10B981' : '#8B5CF6'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

export function GoalsView() {
  const {
    goals,
    contributions,
    settings,
    addGoal,
    updateGoal,
    deleteGoal,
    addGoalContribution,
  } = useFinance();

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalRecord | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Emergency Fund');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [targetDate, setTargetDate] = useState(() => {
    const dt = new Date();
    dt.setMonth(dt.getMonth() + 6);
    return toIsoDate(dt);
  });
  const [notes, setNotes] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  const [contribGoal, setContribGoal] = useState<SavingsGoalRecord | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(() => toIsoDate(new Date()));
  const [contribNotes, setContribNotes] = useState('');
  const [savingContrib, setSavingContrib] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SavingsGoalRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  const openCreateModal = () => {
    setEditingGoal(null);
    setTitle('');
    setCategory('Emergency Fund');
    setTargetAmount('');
    setCurrentAmount('0');
    const dt = new Date();
    dt.setMonth(dt.getMonth() + 6);
    setTargetDate(toIsoDate(dt));
    setNotes('');
    setGoalError(null);
    setGoalModalOpen(true);
  };

  const openEditModal = (g: SavingsGoalRecord) => {
    setEditingGoal(g);
    setTitle(g.title);
    setCategory(g.category);
    setTargetAmount(String(g.targetAmount));
    setCurrentAmount(String(g.currentAmount));
    setTargetDate(g.targetDate);
    setNotes(g.notes || '');
    setGoalError(null);
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalError(null);
    const tAmt = Number(targetAmount);
    const cAmt = Number(currentAmount || 0);
    if (!title.trim() || !Number.isFinite(tAmt) || tAmt <= 0) {
      setGoalError('Please enter a goal title and positive target amount.');
      return;
    }
    if (!Number.isFinite(cAmt) || cAmt < 0) {
      setGoalError('Current saved amount cannot be negative.');
      return;
    }

    setSavingGoal(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        targetAmount: tAmt,
        currentAmount: cAmt,
        targetDate,
        notes: notes.trim(),
      };
      if (editingGoal) {
        await updateGoal(editingGoal.id, payload);
      } else {
        await addGoal(payload);
      }
      setGoalModalOpen(false);
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : 'Unable to save goal.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const amt = Number(contribAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    setSavingContrib(true);
    try {
      await addGoalContribution(contribGoal.id, amt, contribDate, contribNotes.trim());
      setContribGoal(null);
      setContribAmount('');
      setContribNotes('');
    } finally {
      setSavingContrib(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Accumulated</p>
            <p className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(totalSaved, settings.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Combined Target</p>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(totalTarget, settings.currency)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Savings Goal
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-500 flex items-center justify-center mx-auto mb-3">
            <PiggyBank className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No savings goals yet
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Create targets for an Emergency Fund, Laptop, Car, Vacation, or Higher Education to automatically compute required monthly savings.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            const monthsLeft = calculateMonthsRemaining(g.targetDate);
            const requiredMonthly = remaining > 0 ? remaining / monthsLeft : 0;

            return (
              <div
                key={g.id}
                className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                        {g.category}
                      </p>
                      <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                        {g.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(g)}
                        aria-label={`Edit ${g.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-500/10"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(g)}
                        aria-label={`Delete ${g.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-4">
                    <CircularProgress percent={pct} />
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Saved:{' '}
                        <strong className="font-mono text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(g.currentAmount, settings.currency)}
                        </strong>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Target:{' '}
                        <span className="font-mono tabular-nums">
                          {formatCurrency(g.targetAmount, settings.currency)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Remaining:{' '}
                        <span className="font-mono font-semibold text-amber-500 tabular-nums">
                          {formatCurrency(remaining, settings.currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Due {formatDateStr(g.targetDate, settings.dateFormat)}
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                      {remaining > 0
                        ? `${formatCurrency(requiredMonthly, settings.currency)}/mo needed`
                        : 'Goal Achieved'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setContribGoal(g);
                      setContribAmount('');
                      setContribDate(toIsoDate(new Date()));
                      setContribNotes('');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 text-violet-600 dark:text-violet-300 text-xs font-semibold transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add Money Towards Goal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Contributions History */}
      {contributions.length > 0 && (
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Recent Goal Contributions
          </h3>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
            {contributions.slice(0, 6).map((c) => {
              const goalName = goals.find((g) => g.id === c.goalId)?.title || 'Savings Goal';
              return (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{goalName}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {formatDateStr(c.date, settings.dateFormat)}
                      {c.notes ? ` · ${c.notes}` : ''}
                    </p>
                  </div>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{formatCurrency(c.amount, settings.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Goal Modal */}
      <AnimatePresence>
        {goalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGoalModalOpen(false)}
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
                  {editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}
                </h2>
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {goalError && (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                  {goalError}
                </div>
              )}

              <form onSubmit={(e) => void handleSaveGoal(e)} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Goal Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.GOAL_TITLE_MAX}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Buy a Laptop"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                    >
                      {GOAL_TEMPLATES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Target Date
                    </label>
                    <input
                      type="date"
                      required
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Target Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="150000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Already Saved
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.GOAL_NOTES_MAX}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional plan details"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setGoalModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingGoal}
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {savingGoal ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Contribution Modal */}
      <AnimatePresence>
        {contribGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContribGoal(null)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative z-10 w-full max-w-sm rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Add Money: {contribGoal.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setContribGoal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={(e) => void handleAddContribution(e)} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contribution Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={contribDate}
                    onChange={(e) => setContribDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.CONTRIBUTION_NOTES_MAX}
                    value={contribNotes}
                    onChange={(e) => setContribNotes(e.target.value)}
                    placeholder="e.g., Monthly transfer"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setContribGoal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingContrib}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {savingContrib ? 'Adding...' : 'Add Contribution'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Savings Goal"
        description={`Delete "${deleteTarget?.title || ''}"? This cannot be undone.`}
        confirmLabel="Delete Goal"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteGoal(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
