import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Repeat, Sparkles, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  FIELD_LIMITS,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  TRANSACTION_CATEGORIES,
  type PaymentMethod,
  type RecurringFrequency,
  type RecurringTransactionRecord,
  type TransactionCategory,
  type TransactionType,
} from '../../types/finance';
import { toIsoDate } from '../../lib/formatters';
import { computeNextDueDate, RECURRING_FREQUENCY_LABELS } from '../../lib/recurringSchedule';
import { suggestTransactionCategory } from '../../lib/categoryEngine';

interface RecurringTransactionModalProps {
  open: boolean;
  editingRule?: RecurringTransactionRecord | null;
  onClose: () => void;
}

export function RecurringTransactionModal({
  open,
  editingRule = null,
  onClose,
}: RecurringTransactionModalProps) {
  const { transactions, addRecurringTransaction, updateRecurringTransaction } = useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('Rent');
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(() => toIsoDate(new Date()));
  const [nextDueDate, setNextDueDate] = useState(() => toIsoDate(new Date()));
  const [skipPastInitial, setSkipPastInitial] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSkipPastInitial(false);
    if (editingRule) {
      setType(editingRule.type);
      setTitle(editingRule.title);
      setAmount(String(editingRule.amount));
      setCategory(editingRule.category);
      setCategoryManuallySet(true);
      setPaymentMethod(editingRule.paymentMethod);
      setFrequency(editingRule.frequency);
      setStartDate(editingRule.startDate);
      setNextDueDate(editingRule.nextDueDate);
      setActive(editingRule.active);
      setNotes(editingRule.notes || '');
    } else {
      const today = toIsoDate(new Date());
      setType('expense');
      setTitle('');
      setAmount('');
      setCategory('Rent');
      setCategoryManuallySet(false);
      setPaymentMethod('Bank Transfer');
      setFrequency('monthly');
      setStartDate(today);
      setNextDueDate(today);
      setActive(true);
      setNotes('');
    }
  }, [open, editingRule]);

  const suggestionResult = useMemo(() => {
    const parsedAmount = Number(amount);
    return suggestTransactionCategory({
      title,
      notes,
      type,
      amount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
      paymentMethod,
      history: transactions,
    });
  }, [title, notes, type, amount, paymentMethod, transactions]);

  useEffect(() => {
    if (!open || editingRule || categoryManuallySet) return;
    if (suggestionResult.top && suggestionResult.top.confidence >= 45) {
      setCategory(suggestionResult.top.category);
    }
  }, [open, editingRule, categoryManuallySet, suggestionResult.top]);

  // Keep nextDueDate synced when creating a new rule
  useEffect(() => {
    if (!open || editingRule) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;
    if (skipPastInitial) {
      setNextDueDate(computeNextDueDate(startDate, frequency, startDate));
    } else {
      setNextDueDate(startDate);
    }
  }, [open, editingRule, startDate, frequency, skipPastInitial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!title.trim()) {
      setError('Please enter a schedule title.');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
      setError('Please choose valid start and next due dates.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        amount: numAmount,
        type,
        category,
        paymentMethod,
        frequency,
        startDate,
        nextDueDate,
        active,
        notes: notes.trim(),
      };
      if (editingRule) {
        await updateRecurringTransaction(editingRule.id, payload);
      } else {
        await addRecurringTransaction(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save recurring schedule.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-modal-title"
            className="relative z-10 w-full max-w-lg rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-violet-600/15 text-violet-500 flex items-center justify-center">
                  <Repeat className="w-4 h-4" />
                </span>
                <h2
                  id="recurring-modal-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  {editingRule ? 'Edit Recurring Schedule' : 'New Recurring Schedule'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
              {/* Type Segmented Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-white/10">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      if (t === 'income' && !['Salary', 'Freelance', 'Investments', 'Other'].includes(category)) {
                        setCategory('Salary');
                      } else if (t === 'expense' && ['Salary', 'Freelance'].includes(category)) {
                        setCategory('Rent');
                      }
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      type === t
                        ? t === 'income'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Schedule Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.TX_TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === 'income' ? 'e.g., Monthly Tech Salary' : 'e.g., Apartment Rent or Cloud Plan'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={FIELD_LIMITS.AMOUNT_MAX}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    {RECURRING_FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {RECURRING_FREQUENCY_LABELS[freq]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as TransactionCategory);
                      setCategoryManuallySet(true);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    {TRANSACTION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {suggestionResult.top && (
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-3.5 py-2.5 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {category === suggestionResult.top.category
                          ? `Auto-tagged as ${suggestionResult.top.category}`
                          : `Suggested: ${suggestionResult.top.category}`}
                      </span>
                      <span className="text-[11px] font-mono text-violet-600 dark:text-violet-400">
                        {suggestionResult.top.confidence}%
                      </span>
                    </div>
                    {category !== suggestionResult.top.category && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategory(suggestionResult.top!.category);
                          setCategoryManuallySet(true);
                        }}
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline shrink-0"
                      >
                        Apply {suggestionResult.top.category}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {suggestionResult.top.reason}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              {!editingRule && (
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipPastInitial}
                    onChange={(e) => setSkipPastInitial(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span>
                    Already logged for the start date — set next automatic insertion to the{' '}
                    <strong className="text-slate-900 dark:text-white">next cycle</strong>.
                  </span>
                </label>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.TX_NOTES_MAX}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reference, landlord memo, or subscription plan..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
                />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] px-3.5 py-2.5 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Automation Active
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically insert into Transactions when due date arrives.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
              </label>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                >
                  {busy ? 'Saving...' : editingRule ? 'Save Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
