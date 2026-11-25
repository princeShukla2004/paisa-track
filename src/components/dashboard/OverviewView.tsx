import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  FileText,
  PiggyBank,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import {
  CATEGORY_COLORS,
  type DashboardSection,
  type DateFilterPreset,
  type TransactionCategory,
} from '../../types/finance';
import {
  calculatePercentDelta,
  filterTransactionsByDateRange,
  formatCurrency,
  formatDateStr,
  getDateRangeForPreset,
  getMonthLabel,
  toIsoDate,
  toMonthKey,
} from '../../lib/formatters';
import { buildFinancialReportPayload } from '../../lib/pdfReport';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { DashboardSkeleton } from '../ui/Skeleton';
import { ReportPreviewModal } from './ReportPreviewModal';

interface OverviewViewProps {
  onNavigate: (section: DashboardSection) => void;
  onQuickAddTransaction: () => void;
}

const PRESETS: Array<{ id: DateFilterPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

export function OverviewView({ onNavigate, onQuickAddTransaction }: OverviewViewProps) {
  const { isDemoMode } = useAuth();
  const {
    loading,
    profile,
    settings,
    transactions,
    budgets,
    budgetAlerts,
    goals,
    loadSamplePortfolio,
    completeOnboarding,
  } = useFinance();

  const [preset, setPreset] = useState<DateFilterPreset>('month');
  const [customStart, setCustomStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEnd, setCustomEnd] = useState(() => toIsoDate(new Date()));
  const [loadingSample, setLoadingSample] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const range = useMemo(
    () => getDateRangeForPreset(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const filteredTxs = useMemo(
    () => filterTransactionsByDateRange(transactions, range.start, range.end),
    [transactions, range]
  );

  const metrics = useMemo(() => {
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const allIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const allExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const totalBalance = allIncome - allExpenses;

    const periodIncome = filteredTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const periodExpenses = filteredTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const prevMonthIncome = transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(prevMonthKey))
      .reduce((s, t) => s + t.amount, 0);
    const prevMonthExpenses = transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(prevMonthKey))
      .reduce((s, t) => s + t.amount, 0);

    const curMonthIncome = transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(curMonthKey))
      .reduce((s, t) => s + t.amount, 0);
    const curMonthExpenses = transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(curMonthKey))
      .reduce((s, t) => s + t.amount, 0);

    const goalsSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const netPeriodSavings = Math.max(0, periodIncome - periodExpenses);
    const totalSavings = goalsSaved > 0 ? goalsSaved : netPeriodSavings;

    const savingsRate =
      periodIncome > 0 ? ((periodIncome - periodExpenses) / periodIncome) * 100 : 0;
    const prevSavingsRate =
      prevMonthIncome > 0 ? ((prevMonthIncome - prevMonthExpenses) / prevMonthIncome) * 100 : 0;

    return {
      totalBalance,
      periodIncome,
      periodExpenses,
      totalSavings,
      savingsRate,
      incomeDelta: calculatePercentDelta(
        preset === 'month' ? curMonthIncome : periodIncome,
        prevMonthIncome
      ),
      expenseDelta: calculatePercentDelta(
        preset === 'month' ? curMonthExpenses : periodExpenses,
        prevMonthExpenses
      ),
      savingsRateDelta:
        prevMonthIncome > 0 ? savingsRate - prevSavingsRate : null,
      balanceDelta: calculatePercentDelta(
        curMonthIncome - curMonthExpenses,
        prevMonthIncome - prevMonthExpenses
      ),
      curMonthKey,
    };
  }, [transactions, filteredTxs, goals, preset]);

  // Monthly series (last 6 months from stored transactions)
  const monthlySeries = useMemo(() => {
    const now = new Date();
    const months: Array<{
      monthKey: string;
      label: string;
      income: number;
      expenses: number;
      savings: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const inc = transactions
        .filter((t) => t.type === 'income' && toMonthKey(t.date) === mk)
        .reduce((s, t) => s + t.amount, 0);
      const exp = transactions
        .filter((t) => t.type === 'expense' && toMonthKey(t.date) === mk)
        .reduce((s, t) => s + t.amount, 0);
      months.push({
        monthKey: mk,
        label: getMonthLabel(mk).split(' ')[0],
        income: inc,
        expenses: exp,
        savings: Math.max(0, inc - exp),
      });
    }
    return months;
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<TransactionCategory, number>();
    for (const tx of filteredTxs) {
      if (tx.type !== 'expense') continue;
      map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || '#64748B',
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTxs]);

  const budgetChartData = useMemo(() => {
    const monthKey = preset === 'last_month' ? toMonthKey(range.start) : metrics.curMonthKey;
    return budgets
      .filter((b) => b.month === monthKey)
      .map((b) => {
        const spent = transactions
          .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(b.month))
          .reduce((s, t) => s + t.amount, 0);
        return {
          category: b.category,
          spent,
          limit: b.limit,
          pct: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0,
        };
      });
  }, [budgets, transactions, metrics.curMonthKey, preset, range.start]);

  const recentTransactions = useMemo(() => filteredTxs.slice(0, 6), [filteredTxs]);

  const reportPayload = useMemo(() => {
    if (!reportOpen) return null;
    const presetLabel = PRESETS.find((p) => p.id === preset)?.label || 'Selected Range';
    return buildFinancialReportPayload({
      sourceTitle: 'Dashboard Overview & Insights Report',
      filteredTransactions: filteredTxs,
      allTransactions: transactions,
      budgets,
      goals,
      profile,
      settings,
      isDemoMode,
      filters: {
        rangeLabel: presetLabel,
        startDate: range.start,
        endDate: range.end,
      },
      budgetMonthKey: preset === 'last_month' ? toMonthKey(range.start) : metrics.curMonthKey,
      monthlyRows: monthlySeries.map((m) => ({
        label: m.label,
        income: m.income,
        expense: m.expenses,
        net: m.income - m.expenses,
        savingsRate: m.income > 0 ? ((m.income - m.expenses) / m.income) * 100 : 0,
      })),
      extraMetrics: [
        {
          label: 'Total Balance',
          value: formatCurrency(metrics.totalBalance, settings.currency),
          numericValue: metrics.totalBalance,
          isCurrency: true,
          note: 'Cumulative net ledger',
          tone: metrics.totalBalance >= 0 ? 'neutral' : 'negative',
        },
        {
          label: preset === 'month' ? 'Monthly Income' : 'Period Income',
          value: formatCurrency(metrics.periodIncome, settings.currency),
          numericValue: metrics.periodIncome,
          isCurrency: true,
          note: 'Filtered inflow',
          tone: 'positive',
        },
        {
          label: preset === 'month' ? 'Monthly Expenses' : 'Period Expenses',
          value: formatCurrency(metrics.periodExpenses, settings.currency),
          numericValue: metrics.periodExpenses,
          isCurrency: true,
          note: 'Filtered outflow',
          tone: 'negative',
        },
        {
          label: 'Total Savings',
          value: formatCurrency(metrics.totalSavings, settings.currency),
          numericValue: metrics.totalSavings,
          isCurrency: true,
          note: goals.length > 0 ? `${goals.length} active goals` : 'Net surplus',
          tone: 'accent',
        },
        {
          label: 'Savings Rate',
          value: `${metrics.savingsRate.toFixed(1)}%`,
          isCurrency: false,
          note: 'Income retained',
          tone: 'accent',
        },
      ],
    });
  }, [
    reportOpen,
    preset,
    filteredTxs,
    transactions,
    budgets,
    goals,
    profile,
    settings,
    isDemoMode,
    range,
    metrics,
    monthlySeries,
  ]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const showOnboarding = !isDemoMode && transactions.length === 0 && !settings.onboardingCompleted;

  const kpiCards = [
    {
      label: 'Total Balance',
      value: metrics.totalBalance,
      formatter: (v: number) => formatCurrency(v, settings.currency),
      delta: metrics.balanceDelta,
      sub: 'Cumulative net ledger',
      icon: Wallet,
      color: '#8B5CF6',
      spark: monthlySeries.map((m) => ({ v: m.income - m.expenses })),
    },
    {
      label: preset === 'month' ? 'Monthly Income' : 'Period Income',
      value: metrics.periodIncome,
      formatter: (v: number) => formatCurrency(v, settings.currency),
      delta: metrics.incomeDelta,
      sub: 'vs prior month',
      icon: ArrowDownLeft,
      color: '#10B981',
      spark: monthlySeries.map((m) => ({ v: m.income })),
    },
    {
      label: preset === 'month' ? 'Monthly Expenses' : 'Period Expenses',
      value: metrics.periodExpenses,
      formatter: (v: number) => formatCurrency(v, settings.currency),
      delta: metrics.expenseDelta,
      sub: 'vs prior month',
      icon: ArrowUpRight,
      color: '#F59E0B',
      spark: monthlySeries.map((m) => ({ v: m.expenses })),
      invertDeltaGood: true,
    },
    {
      label: 'Total Savings',
      value: metrics.totalSavings,
      formatter: (v: number) => formatCurrency(v, settings.currency),
      delta: null,
      sub: goals.length > 0 ? `${goals.length} active goals` : 'Net surplus',
      icon: PiggyBank,
      color: '#06B6D4',
      spark: monthlySeries.map((m) => ({ v: m.savings })),
    },
    {
      label: 'Savings Rate',
      value: metrics.savingsRate,
      formatter: (v: number) => `${v.toFixed(1)}%`,
      delta: metrics.savingsRateDelta,
      sub: 'Income retained',
      icon: TrendingUp,
      color: '#A855F7',
      spark: monthlySeries.map((m) => ({
        v: m.income > 0 ? Math.max(0, ((m.income - m.expenses) / m.income) * 100) : 0,
      })),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Onboarding Card for brand-new users */}
      {showOnboarding && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] border border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-[#192438]/5 to-cyan-500/10 dark:bg-[#192438] p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                Welcome to PaisaTrack
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
                Set up your personal financial workspace
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Your dashboard updates dynamically from your recorded transactions, budgets, and goals. Add your first entry, import a bank CSV, or load a starter sample dataset to explore right away.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onQuickAddTransaction}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add First Transaction
              </button>
              <button
                type="button"
                onClick={() => onNavigate('transactions')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#101827] hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button
                type="button"
                disabled={loadingSample}
                onClick={() => {
                  setLoadingSample(true);
                  void loadSamplePortfolio().finally(() => setLoadingSample(false));
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {loadingSample ? 'Loading...' : 'Load Sample Portfolio'}
              </button>
              <button
                type="button"
                onClick={() => void completeOnboarding()}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Date Filter Bar & Quick Add */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438]">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                preset === p.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-slate-800 dark:text-slate-200"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF Report
          </button>

          <button
            type="button"
            onClick={onQuickAddTransaction}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const deltaVal = card.delta;
          const isPositive = deltaVal !== null && deltaVal >= 0;
          const isGood = card.invertDeltaGood ? !isPositive : isPositive;

          return (
            <motion.div
              key={card.label}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.16 }}
              className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-1.5 font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    <AnimatedNumber value={card.value} formatter={card.formatter} />
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${card.color}1F`, color: card.color }}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  {deltaVal !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                        isGood ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {isPositive ? '+' : ''}
                      {deltaVal.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {card.sub}
                  </p>
                </div>

                {/* Mini Sparkline */}
                <div className="w-20 h-10 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={card.spark}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={card.color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Primary Charts Row: Income vs Expenses Line/Area + Expense Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Income vs Expenses (6-Month Trend)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monthly cash inflows compared against total recorded spending
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                Income
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
                Expenses
              </span>
            </div>
          </div>

          <div className="mt-5 h-64 w-full">
            {transactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  No transaction history yet
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Record income or expenses to render your 6-month cash flow curve.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCurrency(v, settings.currency, { compact: true })}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), settings.currency)}
                    contentStyle={{
                      backgroundColor: '#101827',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#8B5CF6' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#06B6D4"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#06B6D4' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expense Category Donut */}
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6 flex flex-col">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Expense Breakdown
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Share by category for selected range
          </p>

          {categoryBreakdown.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                No expenses in range
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Add an expense or adjust the date filter above.
              </p>
            </div>
          ) : (
            <>
              <div className="h-44 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => formatCurrency(Number(val), settings.currency)}
                      contentStyle={{
                        backgroundColor: '#101827',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#F8FAFC',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-2 max-h-36 overflow-y-auto pr-1">
                {categoryBreakdown.slice(0, 5).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(cat.value, settings.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Secondary Charts Row: Monthly Spending Bar, Savings Growth Area, Budget Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Spending Bar Chart */}
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Monthly Spending
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Total outflows per month
          </p>
          <div className="mt-4 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={10}
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
                <Bar dataKey="expenses" name="Expenses" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Savings Growth Chart */}
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Net Monthly Savings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Retained cash flow growth
          </p>
          <div className="mt-4 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={10}
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
                <Area
                  type="monotone"
                  dataKey="savings"
                  name="Net Savings"
                  stroke="#10B981"
                  strokeWidth={2.2}
                  fill="url(#savingsAreaGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Utilization Chart */}
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Budget Utilization
                </h2>
                {settings.budgetAlertsEnabled && budgetAlerts.length > 0 && (
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      budgetAlerts.some((a) => a.threshold >= 100)
                        ? 'text-rose-600 dark:text-rose-400'
                        : budgetAlerts.some((a) => a.threshold >= 75)
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-cyan-600 dark:text-cyan-400'
                    }`}
                  >
                    · {budgetAlerts.length} {budgetAlerts.length === 1 ? 'Alert' : 'Alerts'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Actual spend vs category limits
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Manage
            </button>
          </div>

          {budgetChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No category budgets configured for this month.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('budgets')}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-300 text-xs font-semibold hover:bg-violet-600/25 transition-colors"
              >
                Create Budget
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3.5 flex-1">
              {budgetChartData.slice(0, 4).map((b) => {
                const barWidth = Math.min(100, b.pct);
                const statusColor =
                  b.pct >= 100
                    ? 'bg-rose-500'
                    : b.pct >= 90
                    ? 'bg-amber-500'
                    : b.pct >= 75
                    ? 'bg-orange-400'
                    : b.pct >= 50
                    ? 'bg-cyan-500'
                    : 'bg-emerald-500';
                const thresholdLabel =
                  b.pct >= 100
                    ? '100%+ Exceeded'
                    : b.pct >= 90
                    ? '90% Alert'
                    : b.pct >= 75
                    ? '75% Alert'
                    : b.pct >= 50
                    ? '50% Alert'
                    : null;
                const thresholdTextClass =
                  b.pct >= 100
                    ? 'text-rose-600 dark:text-rose-400'
                    : b.pct >= 75
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-cyan-600 dark:text-cyan-400';
                return (
                  <div key={b.category}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {b.category}
                        </span>
                        {thresholdLabel && (
                          <span className={`text-[10px] font-semibold shrink-0 ${thresholdTextClass}`}>
                            · {thresholdLabel}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                        {formatCurrency(b.spent, settings.currency)} / {formatCurrency(b.limit, settings.currency)} ({b.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#101827] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${statusColor}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Transactions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing latest entries matching your selected date filter
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
          >
            View All ({filteredTxs.length})
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No transactions found in this period
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try switching to “This Year” or add a new income/expense entry.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
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
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {tx.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {tx.category} · {formatDateStr(tx.date, settings.dateFormat)} · {tx.paymentMethod}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      tx.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount, settings.currency)}
                  </p>
                  <p className="text-[11px] text-slate-400 capitalize">{tx.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReportPreviewModal
        open={reportOpen}
        payload={reportPayload}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
