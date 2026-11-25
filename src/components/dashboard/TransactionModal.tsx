import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mic, MicOff, Sparkles, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  FIELD_LIMITS,
  PAYMENT_METHODS,
  TRANSACTION_CATEGORIES,
  type PaymentMethod,
  type TransactionCategory,
  type TransactionRecord,
  type TransactionType,
} from '../../types/finance';
import { toIsoDate } from '../../lib/formatters';
import { suggestTransactionCategory } from '../../lib/categoryEngine';
import { parseVoiceTransactionTranscript } from '../../lib/voiceTransactionParser';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

interface TransactionModalProps {
  open: boolean;
  editingTx?: TransactionRecord | null;
  onClose: () => void;
}

export function TransactionModal({ open, editingTx = null, onClose }: TransactionModalProps) {
  const { transactions, recurringTransactions, addTransaction, updateTransaction } = useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('Food');
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceSummary, setVoiceSummary] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const latestTranscriptRef = useRef('');
  const finalizedRef = useRef(false);

  const stopVoiceRecognition = useCallback((abortOnly = false) => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        if (abortOnly) {
          rec.abort();
        } else {
          rec.stop();
        }
      } catch {
        // ignore already-stopped recognition errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopVoiceRecognition(true);
      return;
    }
    setError(null);
    setVoiceError(null);
    setVoiceInterim('');
    setVoiceSummary(null);
    latestTranscriptRef.current = '';
    finalizedRef.current = false;

    if (editingTx) {
      setType(editingTx.type);
      setTitle(editingTx.title);
      setAmount(String(editingTx.amount));
      setCategory(editingTx.category);
      setCategoryManuallySet(true);
      setDate(editingTx.date);
      setPaymentMethod(editingTx.paymentMethod);
      setNotes(editingTx.notes || '');
    } else {
      setType('expense');
      setTitle('');
      setAmount('');
      setCategory('Food');
      setCategoryManuallySet(false);
      setDate(toIsoDate(new Date()));
      setPaymentMethod('UPI');
      setNotes('');
    }
  }, [open, editingTx, stopVoiceRecognition]);

  useEffect(() => {
    return () => {
      stopVoiceRecognition(true);
    };
  }, [stopVoiceRecognition]);

  const applyParsedTranscript = useCallback(
    (transcriptText: string) => {
      const cleaned = transcriptText.trim();
      if (!cleaned) return;
      const parsed = parseVoiceTransactionTranscript(cleaned, {
        history: transactions,
        recurringHistory: recurringTransactions,
        defaultType: type,
      });

      if (parsed.type) {
        setType(parsed.type);
      }
      if (parsed.title) {
        setTitle(parsed.title);
      }
      if (parsed.amount !== null) {
        setAmount(String(parsed.amount));
      }
      if (parsed.paymentMethod) {
        setPaymentMethod(parsed.paymentMethod);
      }
      if (parsed.date) {
        setDate(parsed.date);
      }
      if (parsed.category) {
        setCategory(parsed.category);
        setCategoryManuallySet(
          Boolean(parsed.categoryReason?.startsWith('Matched spoken category'))
        );
      }

      const extractedParts: string[] = [];
      if (parsed.title) extractedParts.push(`Title: ${parsed.title}`);
      if (parsed.amount !== null) extractedParts.push(`Amount: ${parsed.amount}`);
      if (parsed.category) extractedParts.push(`Category: ${parsed.category}`);
      setVoiceSummary(
        extractedParts.length > 0
          ? `Transcribed "${cleaned}" — ${extractedParts.join(' · ')}`
          : `Transcribed "${cleaned}"`
      );
      setVoiceInterim('');
    },
    [transactions, recurringTransactions, type]
  );

  const handleToggleVoiceInput = () => {
    if (isListening) {
      stopVoiceRecognition(false);
      return;
    }

    const SpeechCtor = getSpeechRecognitionCtor();
    if (!SpeechCtor) {
      setVoiceError(
        'Voice input requires a browser with Web Speech API support (such as Chrome, Edge, or Safari).'
      );
      return;
    }

    setVoiceError(null);
    setVoiceSummary(null);
    setVoiceInterim('');
    latestTranscriptRef.current = '';
    finalizedRef.current = false;

    const recognition = new SpeechCtor();
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let combined = '';
      let hasFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res && res[0]) {
          combined += res[0].transcript;
          if (res.isFinal) hasFinal = true;
        }
      }
      const trimmed = combined.trim();
      latestTranscriptRef.current = trimmed;
      setVoiceInterim(trimmed);

      if (hasFinal && trimmed && !finalizedRef.current) {
        finalizedRef.current = true;
        applyParsedTranscript(trimmed);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        setIsListening(false);
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError('Microphone permission denied. Please allow microphone access in your browser.');
      } else if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Tap Voice Input and speak clearly.');
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone detected on this device.');
      } else {
        setVoiceError(`Voice recognition failed (${event.error}). Please try again.`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (!finalizedRef.current && latestTranscriptRef.current) {
        finalizedRef.current = true;
        applyParsedTranscript(latestTranscriptRef.current);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError('Could not start voice recognition. Please try again.');
    }
  };

  const suggestionResult = useMemo(() => {
    const parsedAmount = Number(amount);
    return suggestTransactionCategory({
      title,
      notes,
      type,
      amount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
      paymentMethod,
      history: transactions,
      recurringHistory: recurringTransactions,
    });
  }, [title, notes, type, amount, paymentMethod, transactions, recurringTransactions]);

  useEffect(() => {
    if (!open || editingTx || categoryManuallySet) return;
    if (!title.trim() && !notes.trim()) {
      setCategory(type === 'income' ? 'Salary' : 'Food');
      return;
    }
    if (suggestionResult.top && suggestionResult.top.confidence >= 45) {
      setCategory(suggestionResult.top.category);
    }
  }, [open, editingTx, categoryManuallySet, suggestionResult.top, title, notes, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!title.trim()) {
      setError('Please enter a transaction title.');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Please choose a valid date.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        amount: numAmount,
        type,
        category,
        date,
        paymentMethod,
        notes: notes.trim(),
      };
      if (editingTx) {
        await updateTransaction(editingTx.id, payload);
      } else {
        await addTransaction(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save transaction.');
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
            className="relative z-10 w-full max-w-lg rounded-[20px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingTx ? 'Edit Transaction' : 'Add Transaction'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice input' : 'Voice Input'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isListening
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                      : 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 animate-pulse" />
                      Stop Listening
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      Voice Input
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {(isListening || voiceSummary || voiceError) && (
              <div
                className={`mt-4 rounded-xl border p-3 text-xs flex items-start justify-between gap-2 ${
                  voiceError
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                    : isListening
                    ? 'border-violet-500/35 bg-violet-500/10 text-slate-700 dark:text-slate-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {voiceError ? (
                    <span>{voiceError}</span>
                  ) : isListening ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        Listening... Speak naturally
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {voiceInterim
                          ? `"${voiceInterim}"`
                          : 'Try: "Spent 450 on Uber ride" or "Paid 1200 for groceries via UPI"'}
                      </p>
                    </div>
                  ) : (
                    <span>{voiceSummary}</span>
                  )}
                </div>
                {!isListening && (
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceError(null);
                      setVoiceSummary(null);
                    }}
                    aria-label="Dismiss voice status"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

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
                        setCategoryManuallySet(false);
                      } else if (t === 'expense' && ['Salary', 'Freelance'].includes(category)) {
                        setCategory('Food');
                        setCategoryManuallySet(false);
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
                  Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.TX_TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === 'income' ? 'e.g., Monthly Salary' : 'e.g., Uber Ride or Grocery Store'}
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Category
                    </label>
                    {!editingTx && !categoryManuallySet && suggestionResult.top && suggestionResult.top.category === category && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                        <Sparkles className="w-2.5 h-2.5" />
                        Auto
                      </span>
                    )}
                  </div>
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
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-3.5 py-2.5 flex flex-col gap-2">
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {suggestionResult.top.reason}
                    </p>
                    {suggestionResult.alternatives.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Also:</span>
                        {suggestionResult.alternatives.map((alt) => (
                          <button
                            key={alt.category}
                            type="button"
                            onClick={() => {
                              setCategory(alt.category);
                              setCategoryManuallySet(true);
                            }}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                              category === alt.category
                                ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300'
                                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                            }`}
                          >
                            {alt.category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
                  placeholder="Optional merchant details or memo..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
                />
              </div>

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
                  {busy ? 'Saving...' : editingTx ? 'Save Changes' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
