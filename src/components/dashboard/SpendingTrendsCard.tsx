import React, { useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CATEGORY_COLORS,
  type CurrencyCode,
  type TransactionCategory,
  type TransactionRecord,
} from '../../types/finance';
import { formatCurrency, getMonthLabel, toMonthKey } from '../../lib/formatters';

interface SpendingTrendsCardProps {
  transactions: TransactionRecord[];
  currency: CurrencyCode;
}

type TrendMetricMode = 'amount' | 'mom_pct';

interface TrendRow {
  monthKey: string;
  label: string;
  [key: string]: string | number | null;
}

export function SpendingTrendsCard({ transactions, currency }: SpendingTrendsCardProps) {
  const [metricMode, setMetricMode] = useState<TrendMetricMode>('amount');
  const [selectedCategories, setSelectedCategories] = useState<TransactionCategory[] | null>(null);

  const { rankedCategories, chartData, momSummary } = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) {
      return {
        rankedCategories: [] as Array<{ category: TransactionCategory; total: number; color: string }>,
        chartData: [] as TrendRow[],
        momSummary: [] as Array<{
          category: TransactionCategory;
          color: string;
          latestAmount: number;
          prevAmount: number;
          pctChange: number | null;
        }>,
      };
    }

    // Collect sorted month keys and per-category totals
    const monthSet = new Set<string>();
    const catTotals = new Map<TransactionCategory, number>();
    const monthlyCatSpend = new Map<string, Map<TransactionCategory, number>>();

    for (const tx of expenses) {
      const mk = toMonthKey(tx.date);
      monthSet.add(mk);
      catTotals.set(tx.category, (catTotals.get(tx.category) || 0) + tx.amount);
      const bucket = monthlyCatSpend.get(mk) || new Map<TransactionCategory, number>();
      bucket.set(tx.category, (bucket.get(tx.category) || 0) + tx.amount);
      monthlyCatSpend.set(mk, bucket);
    }

    const sortedMonths = Array.from(monthSet).sort((a, b) => (a < b ? -1 : 1));
    const ranked = Array.from(catTotals.entries())
      .map(([category, total]) => ({
        category,
        total,
        color: CATEGORY_COLORS[category] || '#64748B',
      }))
      .sort((a, b) => b.total - a.total);

    const rows: TrendRow[] = sortedMonths.map((mk, idx) => {
      const prevMk = idx > 0 ? sortedMonths[idx - 1] : null;
      const curBucket = monthlyCatSpend.get(mk);
      const prevBucket = prevMk ? monthlyCatSpend.get(prevMk) : undefined;

      const row: TrendRow = {
        monthKey: mk,
        label: getMonthLabel(mk),
      };

      for (const item of ranked) {
        const curVal = curBucket?.get(item.category) || 0;
        const prevVal = prevBucket?.get(item.category) || 0;
        row[item.category] = curVal;

        const pctKey = `${item.category}__pct`;
        if (idx === 0 || prevVal === 0) {
          row[pctKey] = prevVal === 0 && curVal > 0 && idx > 0 ? 100 : idx === 0 ? null : 0;
        } else {
          row[pctKey] = Number((((curVal - prevVal) / prevVal) * 100).toFixed(1));
        }
      }
      return row;
    });

    const latestMk = sortedMonths[sortedMonths.length - 1];
    const prevMk = sortedMonths.length >= 2 ? sortedMonths[sortedMonths.length - 2] : null;
    const latestBucket = monthlyCatSpend.get(latestMk);
    const prevBucket = prevMk ? monthlyCatSpend.get(prevMk) : undefined;

    const summary = ranked.map((item) => {
      const latestAmount = latestBucket?.get(item.category) || 0;
      const prevAmount = prevBucket?.get(item.category) || 0;
      const pctChange =
        prevMk && prevAmount > 0
          ? ((latestAmount - prevAmount) / prevAmount) * 100
          : null;
      return {
        category: item.category,
        color: item.color,
        latestAmount,
        prevAmount,
        pctChange,
      };
    });

    return {
      rankedCategories: ranked,
      chartData: rows,
      momSummary: summary,
    };
  }, [transactions]);

  const defaultSelected = useMemo(
    () => rankedCategories.slice(0, 5).map((c) => c.category),
    [rankedCategories]
  );

  // Clean up selected categories if scoped categories change
  useEffect(() => {
    if (!selectedCategories) return;
    const validSet = new Set(rankedCategories.map((c) => c.category));
    const filtered = selectedCategories.filter((c) => validSet.has(c));
    if (filtered.length === 0 && defaultSelected.length > 0) {
      setSelectedCategories(null);
    } else if (filtered.length !== selectedCategories.length) {
      setSelectedCategories(filtered);
    }
  }, [rankedCategories, selectedCategories, defaultSelected]);

  const activeCategories = selectedCategories ?? defaultSelected;

  const toggleCategory = (cat: TransactionCategory) => {
    const current = activeCategories;
    if (current.includes(cat)) {
      if (current.length === 1) return; // keep at least one line visible
      setSelectedCategories(current.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...current, cat]);
    }
  };

  const chartDisplayRows = useMemo(() => {
    if (metricMode === 'amount') return chartData;
    return chartData.slice(1).map((row) => {
      const next: TrendRow = {
        monthKey: row.monthKey,
        label: row.label,
      };
      for (const cat of activeCategories) {
        next[cat] = row[`${cat}__pct`] ?? 0;
      }
      return next;
    });
  }, [chartData, metricMode, activeCategories]);

  return (
    <section
      aria-label="Spending Trends"
      className="rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6 space-y-5"
    >
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Spending Trends
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Month-over-month category spending trajectories across selected periods
          </p>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricMode('amount')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              metricMode === 'amount'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly Spend
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('mom_pct')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              metricMode === 'mom_pct'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            MoM % Change
          </button>
        </div>
      </div>

      {rankedCategories.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          Add expense transactions in this range to visualize category spending trends.
        </div>
      ) : (
        <>
          {/* Category Visibility Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {rankedCategories.map((item) => {
              const active = activeCategories.includes(item.category);
              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => toggleCategory(item.category)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    active
                      ? 'border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-[#101827] text-slate-900 dark:text-white'
                      : 'border-slate-200/70 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: item.color,
                      opacity: active ? 1 : 0.35,
                    }}
                  />
                  {item.category}
                </button>
              );
            })}
            {rankedCategories.length > 5 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedCategories(
                    activeCategories.length === rankedCategories.length
                      ? null
                      : rankedCategories.map((c) => c.category)
                  )
                }
                className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline px-2 py-1"
              >
                {activeCategories.length === rankedCategories.length ? 'Reset Top 5' : 'Select All'}
              </button>
            )}
          </div>

          {/* Line Chart */}
          {metricMode === 'mom_pct' && chartDisplayRows.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-xs text-slate-400">
              Select a range spanning at least 2 months to compare month-over-month % changes.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartDisplayRows}
                  margin={{ top: 10, right: 12, left: -6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      metricMode === 'mom_pct'
                        ? `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(0)}%`
                        : formatCurrency(Number(v), currency, { compact: true })
                    }
                  />
                  {metricMode === 'mom_pct' && (
                    <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
                  )}
                  <Tooltip
                    formatter={(value, name) => {
                      const num = Number(value);
                      if (metricMode === 'mom_pct') {
                        return [`${num > 0 ? '+' : ''}${num.toFixed(1)}% vs prior mo`, String(name)];
                      }
                      return [formatCurrency(num, currency), String(name)];
                    }}
                    contentStyle={{
                      backgroundColor: '#101827',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                  />
                  {activeCategories.map((cat) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      name={cat}
                      stroke={CATEGORY_COLORS[cat] || '#8B5CF6'}
                      strokeWidth={2.5}
                      dot={{ r: 3.5, strokeWidth: 1.5, fill: '#101827' }}
                      activeDot={{ r: 5.5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Latest Month-over-Month Category Movers */}
          {chartData.length >= 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
              {momSummary
                .filter((m) => activeCategories.includes(m.category))
                .slice(0, 4)
                .map((item) => {
                  const pct = item.pctChange;
                  const isDown = pct !== null && pct < 0;
                  const isUp = pct !== null && pct > 0;
                  return (
                    <div
                      key={item.category}
                      className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#101827] p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.category}
                          </p>
                        </div>
                        <p className="mt-1 font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(item.latestAmount, currency)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {pct === null ? (
                          <span className="text-[11px] text-slate-400">New</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-mono font-semibold tabular-nums ${
                              isDown
                                ? 'text-emerald-500'
                                : isUp
                                ? 'text-amber-500'
                                : 'text-slate-400'
                            }`}
                          >
                            {isDown ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : isUp ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : null}
                            {pct > 0 ? '+' : ''}
                            {pct.toFixed(1)}%
                          </span>
                        )}
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">MoM</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
