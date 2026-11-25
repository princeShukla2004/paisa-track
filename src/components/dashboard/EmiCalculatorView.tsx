import React, { useMemo, useState } from 'react';
import { BellPlus, Calculator, Download, Trash2 } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useFinance } from '../../context/FinanceContext';
import { useToast } from '../../context/ToastContext';
import type { LoanType } from '../../types/finance';
import { calculateEmiBreakdown, escapeCsvCell, formatCurrency } from '../../lib/formatters';

const LOAN_PRESETS: Record<
  LoanType,
  { defaultPrincipal: number; defaultRate: number; defaultYears: number }
> = {
  'Home Loan': { defaultPrincipal: 4500000, defaultRate: 8.5, defaultYears: 20 },
  'Personal Loan': { defaultPrincipal: 500000, defaultRate: 11.5, defaultYears: 3 },
  'Car Loan': { defaultPrincipal: 1000000, defaultRate: 9.0, defaultYears: 5 },
  'Education Loan': { defaultPrincipal: 1200000, defaultRate: 9.5, defaultYears: 7 },
};

export function EmiCalculatorView() {
  const { settings, emiPlans, addEmiPlan, deleteEmiPlan } = useFinance();
  const { showToast } = useToast();

  const [loanType, setLoanType] = useState<LoanType>('Home Loan');
  const [principal, setPrincipal] = useState(4500000);
  const [annualRate, setAnnualRate] = useState(8.5);
  const [tenureValue, setTenureValue] = useState(20);
  const [tenureUnit, setTenureUnit] = useState<'years' | 'months'>('years');
  const [scheduleView, setScheduleView] = useState<'yearly' | 'monthly'>('yearly');

  const [reminderTitle, setReminderTitle] = useState('');
  const [dueDay, setDueDay] = useState(5);
  const [savingReminder, setSavingReminder] = useState(false);

  const tenureMonths = useMemo(() => {
    const raw = tenureUnit === 'years' ? tenureValue * 12 : tenureValue;
    return Math.min(600, Math.max(1, Math.round(raw || 1)));
  }, [tenureValue, tenureUnit]);

  const emiData = useMemo(
    () => calculateEmiBreakdown(Math.max(1, principal), Math.max(0, annualRate), tenureMonths),
    [principal, annualRate, tenureMonths]
  );

  const pieData = useMemo(
    () => [
      { name: 'Principal', value: Math.max(0, principal), color: '#8B5CF6' },
      { name: 'Total Interest', value: Math.max(0, emiData.totalInterest), color: '#06B6D4' },
    ],
    [principal, emiData.totalInterest]
  );

  const yearlySchedule = useMemo(() => {
    const years: Array<{
      year: number;
      emiTotal: number;
      principalPaid: number;
      interestPaid: number;
      endingBalance: number;
    }> = [];
    for (let i = 0; i < emiData.schedule.length; i += 12) {
      const slice = emiData.schedule.slice(i, i + 12);
      years.push({
        year: Math.floor(i / 12) + 1,
        emiTotal: slice.reduce((s, r) => s + r.emi, 0),
        principalPaid: slice.reduce((s, r) => s + r.principalPaid, 0),
        interestPaid: slice.reduce((s, r) => s + r.interestPaid, 0),
        endingBalance: slice[slice.length - 1]?.remainingBalance ?? 0,
      });
    }
    return years;
  }, [emiData.schedule]);

  const selectLoanPreset = (type: LoanType) => {
    const p = LOAN_PRESETS[type];
    setLoanType(type);
    setPrincipal(p.defaultPrincipal);
    setAnnualRate(p.defaultRate);
    setTenureUnit('years');
    setTenureValue(p.defaultYears);
  };

  const handleExportSchedule = () => {
    const headers = ['Month', 'EMI', 'Principal', 'Interest', 'RemainingBalance'];
    const lines = [
      headers.join(','),
      ...emiData.schedule.map((r) =>
        [
          r.month,
          escapeCsvCell(r.emi.toFixed(2)),
          escapeCsvCell(r.principalPaid.toFixed(2)),
          escapeCsvCell(r.interestPaid.toFixed(2)),
          escapeCsvCell(r.remainingBalance.toFixed(2)),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paisatrack-${loanType.toLowerCase().replace(/\s+/g, '-')}-amortization.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Amortization schedule exported', { variant: 'success' });
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = reminderTitle.trim() || `${loanType} EMI`;
    setSavingReminder(true);
    try {
      await addEmiPlan({
        title,
        loanType,
        principal: Math.max(1, principal),
        annualRate: Math.max(0.1, annualRate),
        tenureMonths,
        dueDay,
        reminderEnabled: true,
      });
      setReminderTitle('');
    } finally {
      setSavingReminder(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Loan Type Presets */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(LOAN_PRESETS) as LoanType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => selectLoanPreset(type)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              loanType === type
                ? 'bg-violet-600 text-white shadow-sm'
                : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Calculator Inputs + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {loanType} Parameters
            </h2>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Loan Amount</span>
              <input
                type="number"
                min="1000"
                max="1000000000"
                value={principal}
                onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value)))}
                className="w-36 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-right font-mono font-semibold text-slate-900 dark:text-white"
              />
            </div>
            <input
              type="range"
              min={50000}
              max={20000000}
              step={25000}
              value={Math.min(20000000, principal)}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Annual Interest Rate (% p.a.)
              </span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={annualRate}
                onChange={(e) => setAnnualRate(Math.max(0.1, Math.min(50, Number(e.target.value))))}
                className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-right font-mono font-semibold text-slate-900 dark:text-white"
              />
            </div>
            <input
              type="range"
              min={4}
              max={24}
              step={0.1}
              value={Math.min(24, annualRate)}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Loan Tenure</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={tenureUnit === 'years' ? 50 : 600}
                  value={tenureValue}
                  onChange={(e) => setTenureValue(Math.max(1, Number(e.target.value)))}
                  className="w-20 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-right font-mono font-semibold text-slate-900 dark:text-white"
                />
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (tenureUnit === 'months') {
                        setTenureUnit('years');
                        setTenureValue(Math.max(1, Math.round(tenureValue / 12)));
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      tenureUnit === 'years' ? 'bg-violet-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    Years
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tenureUnit === 'years') {
                        setTenureUnit('months');
                        setTenureValue(tenureValue * 12);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      tenureUnit === 'months' ? 'bg-violet-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    Months
                  </button>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={tenureUnit === 'years' ? 30 : 360}
              value={Math.min(tenureUnit === 'years' ? 30 : 360, tenureValue)}
              onChange={(e) => setTenureValue(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
          </div>

          {/* Save EMI Reminder Form */}
          <form
            onSubmit={(e) => void handleSaveReminder(e)}
            className="pt-4 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Save Monthly Reminder Label
              </label>
              <input
                type="text"
                maxLength={100}
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder={`${loanType} Reminder`}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Due Day (1–28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={dueDay}
                onChange={(e) => setDueDay(Math.min(28, Math.max(1, Number(e.target.value))))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={savingReminder}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-60"
            >
              <BellPlus className="w-3.5 h-3.5" />
              Save Reminder
            </button>
          </form>
        </div>

        {/* Breakdown & Pie Chart */}
        <div className="lg:col-span-5 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly EMI (Reducing Balance)
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">
              {formatCurrency(emiData.monthlyEmi, settings.currency)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/10 text-xs">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Total Principal</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(principal, settings.currency)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Total Interest</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-cyan-500 tabular-nums">
                  {formatCurrency(emiData.totalInterest, settings.currency)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400">Total Payment ({tenureMonths} months)</p>
                <p className="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(emiData.totalPayment, settings.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="h-44 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
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
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Saved EMI Reminders */}
      {emiPlans.length > 0 && (
        <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Saved EMI Reminders
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {emiPlans.map((plan) => {
              const calc = calculateEmiBreakdown(plan.principal, plan.annualRate, plan.tenureMonths);
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {plan.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {plan.loanType} · Day {plan.dueDay} monthly ·{' '}
                      <span className="font-mono text-violet-500">
                        {formatCurrency(calc.monthlyEmi, settings.currency)}/mo
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteEmiPlan(plan.id)}
                    aria-label={`Delete ${plan.title}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Amortization Schedule Table */}
      <div className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Amortization Schedule
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Principal and interest reduction over time
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setScheduleView('yearly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  scheduleView === 'yearly' ? 'bg-violet-600 text-white' : 'text-slate-500'
                }`}
              >
                Yearly
              </button>
              <button
                type="button"
                onClick={() => setScheduleView('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  scheduleView === 'monthly' ? 'bg-violet-600 text-white' : 'text-slate-500'
                }`}
              >
                Monthly
              </button>
            </div>
            <button
              type="button"
              onClick={handleExportSchedule}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-[#141d2e] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{scheduleView === 'yearly' ? 'Year' : 'Month'}</th>
                <th className="py-3 px-4 text-right">Total Payment</th>
                <th className="py-3 px-4 text-right">Principal</th>
                <th className="py-3 px-4 text-right">Interest</th>
                <th className="py-3 px-4 text-right">Remaining Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono tabular-nums">
              {scheduleView === 'yearly'
                ? yearlySchedule.map((row) => (
                    <tr key={row.year} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-white">
                        Year {row.year}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(row.emiTotal, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.principalPaid, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-cyan-600 dark:text-cyan-400">
                        {formatCurrency(row.interestPaid, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 dark:text-white">
                        {formatCurrency(row.endingBalance, settings.currency)}
                      </td>
                    </tr>
                  ))
                : emiData.schedule.map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-white">
                        Month {row.month}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(row.emi, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.principalPaid, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-cyan-600 dark:text-cyan-400">
                        {formatCurrency(row.interestPaid, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 dark:text-white">
                        {formatCurrency(row.remainingBalance, settings.currency)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
