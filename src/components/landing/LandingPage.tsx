import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Calculator,
  ChevronDown,
  Lock,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BrandLogo } from '../ui/BrandLogo';
import type { AuthModalMode } from '../auth/AuthModal';

interface LandingPageProps {
  onOpenAuth: (mode: AuthModalMode) => void;
  onExploreDemo: () => void;
}

const PREVIEW_SERIES = [
  { month: 'Jun', income: 115000, expenses: 51200 },
  { month: 'Jul', income: 120000, expenses: 49800 },
  { month: 'Aug', income: 128500, expenses: 54100 },
  { month: 'Sep', income: 132000, expenses: 58300 },
  { month: 'Oct', income: 140000, expenses: 56200 },
  { month: 'Nov', income: 145000, expenses: 62400 },
];

const SAMPLE_TESTIMONIALS = [
  {
    name: 'Arjun Nair',
    role: 'Staff Software Engineer · Bengaluru',
    initials: 'AN',
    avatarClass:
      'bg-gradient-to-br from-violet-500/90 via-purple-600/90 to-indigo-700/90 border-violet-300/30 shadow-[0_0_16px_rgba(139,92,246,0.28)]',
    quote:
      'Before PaisaTrack, I tracked expenses across three spreadsheets. Consolidating UPI and card entries helped me cut discretionary dining spend by ₹4,800/month within 60 days.',
    outcome: 'Saved ₹57,600 annually (Sample Profile)',
  },
  {
    name: 'Meera Deshmukh',
    role: 'Lead Product Designer · Pune',
    initials: 'MD',
    avatarClass:
      'bg-gradient-to-br from-sky-500/90 via-blue-600/90 to-indigo-700/90 border-blue-300/30 shadow-[0_0_16px_rgba(59,130,246,0.28)]',
    quote:
      'The category threshold alerts at 75% and 90% keep my monthly shopping limits visible without nagging. My emergency fund reached its 6-month target four weeks ahead of schedule.',
    outcome: '100% emergency reserve funded (Sample Profile)',
  },
  {
    name: 'Rohan Kulkarni',
    role: 'Independent Consultant · Mumbai',
    initials: 'RK',
    avatarClass:
      'bg-gradient-to-br from-teal-400/90 via-teal-600/90 to-cyan-700/90 border-teal-300/30 shadow-[0_0_16px_rgba(20,184,166,0.28)]',
    quote:
      'Having reducing-balance EMI amortization schedules alongside monthly cash flow analytics made planning a car loan prepayment straightforward and transparent.',
    outcome: '14 months shaved off loan tenure (Sample Profile)',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How does PaisaTrack keep my financial records private?',
    a: 'Every user account is authenticated via Firebase Authentication and strictly isolated in Cloud Firestore using per-user security rules. Your profile, settings, and transactions are readable and writable only by your verified account.',
  },
  {
    q: 'Does the AI Financial Assistant share my data or fabricate numbers?',
    a: 'No. AI requests run strictly through our server-side endpoint using your actual stored category and cash-flow figures. Our prompt guardrails forbid inventing transactions and explicitly label estimates versus recorded actuals.',
  },
  {
    q: 'Can I import existing transactions from my bank statement?',
    a: 'Yes. The Transactions module supports CSV import with row validation and preview, as well as one-click CSV and printable PDF report exports.',
  },
  {
    q: 'Which currencies and themes are supported?',
    a: 'PaisaTrack defaults to INR (₹) with Indian number formatting, and lets you switch anytime to USD ($), EUR (€), or GBP (£), alongside both Dark and Light themes.',
  },
  {
    q: 'Can I explore the dashboard before creating an account?',
    a: 'Yes. Click Explore Dashboard to inspect a clearly labeled Sample Portfolio inside the full workspace—including interactive charts, budgets, EMI calculator, and AI assistant.',
  },
];

export function LandingPage({ onOpenAuth, onExploreDemo }: LandingPageProps) {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeInsightTab, setActiveInsightTab] = useState<'comparison' | 'savings' | 'forecast'>(
    'comparison'
  );

  return (
    <div className="min-h-screen bg-[#101827] text-slate-100 overflow-x-hidden">
      {/* Subtle ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(124,58,237,0.22),rgba(6,182,212,0.06)_55%,transparent)]"
      />

      {/* Top Bar: Clean 3-zone contract */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101827]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a href="#top" className="whitespace-nowrap shrink-0">
            <BrandLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#ai-insights" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              AI Insights
            </a>
            <a href="#pricing" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6"
            >
              <p className="text-sm font-medium text-cyan-400 tracking-wide">
                Your Money. Your Goals. Your Future.
              </p>
              <h1
                className="mt-3 font-display font-bold tracking-tight text-white leading-[1.1] text-balance"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)' }}
              >
                Take Control of Your Money. Build a Better Financial Future.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                PaisaTrack unifies income and expense tracking, category budgets, savings targets, reducing-balance EMI planning, and grounded Gemini AI insights in one focused financial command center.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all whitespace-nowrap shrink-0"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onExploreDemo}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 bg-[#192438] hover:bg-[#22304a] text-slate-100 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="text-sm font-medium text-slate-300 hover:text-white underline-offset-4 hover:underline px-2 py-2 whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
              </div>

              <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-slate-400">
                <span>Multi-Currency (INR · USD · EUR · GBP)</span>
                <span aria-hidden="true">·</span>
                <span>CSV Import &amp; PDF Reports</span>
                <span aria-hidden="true">·</span>
                <span>Per-User Encrypted Cloud Storage</span>
              </div>
            </motion.div>

            {/* Animated Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 relative"
            >
              <div className="rounded-[22px] border border-white/10 bg-[#192438] p-5 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <p className="text-xs text-slate-400">Sample Portfolio Preview</p>
                    <p className="text-lg font-bold text-white tabular-nums mt-0.5">₹2,84,500 Net Balance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Savings Rate</p>
                    <p className="text-base font-semibold text-emerald-400 tabular-nums mt-0.5">56.9% · +4.2% MoM</p>
                  </div>
                </div>

                {/* Live Animated Recharts Preview */}
                <div className="mt-5 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={PREVIEW_SERIES} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="heroIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="heroExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="month"
                        stroke="#64748B"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#101827',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        name="Income"
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        fill="url(#heroIncomeGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        name="Expenses"
                        stroke="#06B6D4"
                        strokeWidth={2}
                        fill="url(#heroExpenseGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Floating Metric Strip */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-2xl bg-[#101827] border border-white/10 p-3.5"
                  >
                    <p className="text-xs text-slate-400">Monthly Income</p>
                    <p className="mt-1 text-base font-bold text-white tabular-nums">₹1,45,000</p>
                    <p className="mt-0.5 text-xs text-emerald-400">+3.6% vs Oct</p>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-2xl bg-[#101827] border border-white/10 p-3.5"
                  >
                    <p className="text-xs text-slate-400">Monthly Spend</p>
                    <p className="mt-1 text-base font-bold text-white tabular-nums">₹62,400</p>
                    <p className="mt-0.5 text-xs text-amber-400">Food at 107% cap</p>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-2xl bg-[#101827] border border-white/10 p-3.5"
                  >
                    <p className="text-xs text-slate-400">Emergency Goal</p>
                    <p className="mt-1 text-base font-bold text-white tabular-nums">62% Funded</p>
                    <p className="mt-0.5 text-xs text-cyan-400">₹1.85L / ₹3.00L</p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Asymmetric Bento Grid */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
              Every financial workflow, structured cleanly in one place
            </h2>
            <p className="mt-3 text-slate-300 text-base leading-relaxed">
              Built for daily expense discipline and long-term capital clarity—without cluttered spreadsheets or opaque algorithms.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 rounded-[20px] border border-white/10 bg-[#192438] p-7">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Complete Transaction Ledger &amp; CSV Sync
              </h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
                Record income and expenses across 12 categories and 6 payment methods (UPI, Card, Bank Transfer, Cash, Wallet). Search, sort by amount, filter by custom date ranges, or batch-import bank CSV statements in seconds.
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-[#192438] p-7">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Smart Category Budgets</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Set monthly category caps and receive structured alerts at 50%, 75%, 90%, and 100% utilization based on actual transactions.
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-[#192438] p-7">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <PiggyBank className="w-5 h-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Savings Goal Milestones</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Track Emergency Funds, hardware upgrades, or travel targets with required monthly savings calculations and atomic contribution logs.
              </p>
            </div>

            <div className="md:col-span-2 rounded-[20px] border border-white/10 bg-[#192438] p-7">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Reducing-Balance EMI &amp; Amortization Planner
              </h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
                Model Home, Personal, Car, and Education loans with exact principal vs. interest breakdowns, month-by-month amortization schedules, and saved due-date reminders.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Three steps from raw transactions to clarity
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01. Log or Import',
                title: 'Capture every inflow and expense',
                body: 'Start with a clean slate or import your existing CSV statement. Every record syncs immediately to your private Firestore vault.',
              },
              {
                step: '02. Allocate & Target',
                title: 'Define category budgets and goals',
                body: 'Set realistic monthly category ceilings and savings deadlines. PaisaTrack calculates your daily burn rate and required monthly contributions automatically.',
              },
              {
                step: '03. Ask Your AI Assistant',
                title: 'Inspect trends with grounded answers',
                body: 'Query your spending patterns in plain language. Receive month-over-month comparisons and actionable savings ideas rooted in your real numbers.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-[20px] border border-white/10 bg-[#192438] p-6">
                <p className="text-sm font-semibold text-cyan-400">{item.step}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI Insights Showcase */}
        <section id="ai-insights" className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white text-balance">
                AI financial analysis grounded strictly in your actual ledger
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                No fabricated metrics or generic advice. PaisaTrack summarizes your real category totals, compares consecutive months, and clearly separates recorded figures from estimated savings potential.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {(
                  [
                    { id: 'comparison', label: 'MoM Comparison' },
                    { id: 'savings', label: 'Savings Ideas' },
                    { id: 'forecast', label: 'Monthly Summary' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveInsightTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      activeInsightTab === tab.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#192438] text-slate-300 hover:text-white border border-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[20px] border border-white/10 bg-[#192438] p-6 space-y-4">
                {activeInsightTab === 'comparison' && (
                  <>
                    <div className="rounded-xl bg-[#101827] border border-white/10 p-4">
                      <p className="text-xs text-slate-400">Sample Prompt</p>
                      <p className="mt-1 text-sm font-medium text-white">
                        “Compare my Food and Entertainment spending against last month.”
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#101827] border border-violet-500/30 p-4 text-sm text-slate-200 leading-relaxed space-y-2">
                      <p>
                        <strong className="text-white">Recorded Actuals:</strong> You spent{' '}
                        <span className="font-mono text-amber-300">₹12,800</span> on Food this month compared to{' '}
                        <span className="font-mono">₹10,850</span> last month (+18.0%). Entertainment expenses rose by{' '}
                        <span className="font-mono text-amber-300">₹1,200</span> (+46.2%, from ₹2,600 to ₹3,800).
                      </p>
                      <p className="text-xs text-slate-400">
                        Basis: Recorded transactions in Sample Portfolio.
                      </p>
                    </div>
                  </>
                )}

                {activeInsightTab === 'savings' && (
                  <>
                    <div className="rounded-xl bg-[#101827] border border-white/10 p-4">
                      <p className="text-xs text-slate-400">Sample Prompt</p>
                      <p className="mt-1 text-sm font-medium text-white">
                        “Where can I free up cash flow without touching fixed bills?”
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#101827] border border-violet-500/30 p-4 text-sm text-slate-200 leading-relaxed space-y-2">
                      <p>
                        <strong className="text-white">Estimated Opportunity:</strong> Bringing Food back to your ₹12,000 cap saves{' '}
                        <span className="font-mono text-emerald-400">₹800</span>, and trimming discretionary Shopping by 15% saves an estimated{' '}
                        <span className="font-mono text-emerald-400">₹1,410</span> (~₹2,210/month total).
                      </p>
                      <p className="text-xs text-slate-400">
                        Note: Figures marked estimated are illustrative projections, not guaranteed financial outcomes.
                      </p>
                    </div>
                  </>
                )}

                {activeInsightTab === 'forecast' && (
                  <>
                    <div className="rounded-xl bg-[#101827] border border-white/10 p-4">
                      <p className="text-xs text-slate-400">Sample Prompt</p>
                      <p className="mt-1 text-sm font-medium text-white">
                        “Summarize my cash flow and goal pacing for this month.”
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#101827] border border-violet-500/30 p-4 text-sm text-slate-200 leading-relaxed space-y-2">
                      <p>
                        <strong className="text-white">Recorded Cash Flow:</strong> Income stands at{' '}
                        <span className="font-mono text-emerald-400">₹1,45,000</span> against expenses of{' '}
                        <span className="font-mono">₹62,400</span>, yielding a{' '}
                        <span className="font-mono text-cyan-300">56.97%</span> net savings rate (₹82,600 surplus).
                      </p>
                      <p className="text-xs text-slate-400">
                        At your current pace, your Emergency Fund target (₹1,15,000 remaining) can be completed within 8 months.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Security & Privacy */}
        <section className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="rounded-[22px] border border-white/10 bg-[#192438] p-8 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="mt-4 font-display text-2xl sm:text-3xl font-bold text-white">
                Security-first financial architecture
              </h2>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                Your financial records belong strictly to you. PaisaTrack enforces server-side AI key isolation, verified authentication tokens, and strict Firestore owner-only security rules.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-[#101827] border border-white/10 p-4">
                <Lock className="w-4 h-4 text-cyan-400 mb-2" />
                <p className="font-semibold text-white">Per-User Isolation</p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Database rules enforce verified UID ownership on every read and write.
                </p>
              </div>
              <div className="rounded-2xl bg-[#101827] border border-white/10 p-4">
                <TrendingUp className="w-4 h-4 text-violet-400 mb-2" />
                <p className="font-semibold text-white">Full Data Portability</p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Export all transactions in CSV/JSON or delete your account anytime.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials (Clearly labeled Sample / Demo Profiles) */}
        <section className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-cyan-400 tracking-wide">
                Sample User Stories (Demo Profiles)
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold text-white">
                Built for clarity across every stage of saving
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Illustrative sample personas demonstrating real platform workflows.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-[20px] border border-white/10 bg-[#192438] p-6 flex flex-col justify-between"
              >
                <p className="text-sm text-slate-200 leading-relaxed">“{t.quote}”</p>
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3.5">
                  <div
                    aria-hidden="true"
                    className={`w-11 h-11 rounded-full border flex items-center justify-center shrink-0 font-display text-xs font-bold tracking-wide text-white select-none ${t.avatarClass}`}
                  >
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                    <p className="text-xs text-slate-400 truncate">{t.role}</p>
                    <p className="text-xs text-emerald-400 mt-0.5 truncate">{t.outcome}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                Transparent plans with clear limits
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Start free with full core budgeting, goals, and EMI planning.
              </p>
            </div>
            <div className="inline-flex items-center p-1 rounded-xl bg-[#192438] border border-white/10 self-start">
              <button
                type="button"
                onClick={() => setAnnualBilling(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  !annualBilling ? 'bg-violet-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnualBilling(true)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  annualBilling ? 'bg-violet-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter Free',
                audience: 'For individual expense tracking',
                price: '₹0',
                cadence: 'forever',
                cta: 'Get Started Free',
                featured: false,
                limits: [
                  'Unlimited manual transactions & CSV export',
                  'Up to 10 monthly category budgets',
                  'Up to 5 active savings goals',
                  'Full reducing-balance EMI calculator',
                ],
              },
              {
                name: 'PaisaTrack Plus',
                audience: 'For active savers & planners',
                price: annualBilling ? '₹199' : '₹249',
                cadence: '/ month',
                cta: 'Start Free Account',
                featured: true,
                limits: [
                  'Unlimited budgets, goals & EMI reminders',
                  'Gemini AI Financial Assistant insights',
                  'Batch CSV statement imports (up to 5,000 rows)',
                  'Automated unusual-spend & threshold alerts',
                ],
              },
              {
                name: 'Advisor Pro',
                audience: 'For multi-currency & deep reporting',
                price: annualBilling ? '₹449' : '₹549',
                cadence: '/ month',
                cta: 'Explore Workspace',
                featured: false,
                limits: [
                  'All Plus features across 4 currencies',
                  'Yearly cash flow & MoM PDF report exports',
                  'Priority Gemini analytical summaries',
                  'Full JSON archival backup anytime',
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[20px] p-7 flex flex-col justify-between border ${
                  plan.featured
                    ? 'border-violet-500/60 bg-[#1c2841] shadow-xl shadow-violet-950/30'
                    : 'border-white/10 bg-[#192438]'
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-cyan-400">{plan.audience}</p>
                  <h3 className="mt-1.5 text-xl font-bold text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-bold text-white tabular-nums">
                      {plan.price}
                    </span>
                    <span className="text-xs text-slate-400">{plan.cadence}</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                    {plan.limits.map((line) => (
                      <li key={line} className="leading-relaxed">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => (plan.name === 'Advisor Pro' ? onExploreDemo() : onOpenAuth('register'))}
                  className={`mt-7 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                    plan.featured
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'border border-white/15 bg-[#101827] hover:bg-white/5 text-white'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-4xl mx-auto px-6 py-20 border-t border-white/10">
          <h2 className="font-display text-3xl font-bold text-white text-center">
            Frequently Asked Questions
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-white/10 bg-[#192438] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left text-sm sm:text-base font-semibold text-white hover:bg-white/[0.02] transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0c1320]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <BrandLogo />
            <p className="mt-2 text-xs text-slate-400">
              Your Money. Your Goals. Your Future.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#ai-insights" className="hover:text-white transition-colors">
              AI Insights
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <button
              type="button"
              onClick={onExploreDemo}
              className="hover:text-white transition-colors"
            >
              Demo Dashboard
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors"
            >
              Sign In
            </button>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} PaisaTrack. Educational personal finance analytics.
          </p>
        </div>
      </footer>
    </div>
  );
}
