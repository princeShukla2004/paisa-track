import React, { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatDateStr } from '../../lib/formatters';
import type { FinancialReportPayload, ReportSectionSelection } from '../../lib/pdfReport';

interface PdfCaptureTemplateProps {
  payload: FinancialReportPayload;
  sections: ReportSectionSelection;
}

const TX_ROWS_PER_CHUNK = 16;

export const PdfCaptureTemplate = forwardRef<HTMLDivElement, PdfCaptureTemplateProps>(
  ({ payload, sections }, ref) => {
    const activeFilterParts: string[] = [`Range: ${payload.filters.rangeLabel}`];
    if (payload.filters.startDate || payload.filters.endDate) {
      const startText = payload.filters.startDate
        ? formatDateStr(payload.filters.startDate, payload.dateFormat)
        : 'Earliest';
      const endText = payload.filters.endDate
        ? formatDateStr(payload.filters.endDate, payload.dateFormat)
        : 'Latest';
      activeFilterParts.push(`Dates: ${startText} – ${endText}`);
    }
    if (payload.filters.typeFilter && payload.filters.typeFilter !== 'all') {
      activeFilterParts.push(`Type: ${payload.filters.typeFilter}`);
    }
    if (payload.filters.categoryFilter && payload.filters.categoryFilter !== 'all') {
      activeFilterParts.push(`Category: ${payload.filters.categoryFilter}`);
    }
    if (payload.filters.paymentFilter && payload.filters.paymentFilter !== 'all') {
      activeFilterParts.push(`Method: ${payload.filters.paymentFilter}`);
    }
    if (payload.filters.searchQuery) {
      activeFilterParts.push(`Search: "${payload.filters.searchQuery}"`);
    }
    if (payload.filters.sortLabel) {
      activeFilterParts.push(`Sort: ${payload.filters.sortLabel}`);
    }

    const txChunks: Array<typeof payload.transactions> = [];
    for (let i = 0; i < payload.transactions.length; i += TX_ROWS_PER_CHUNK) {
      txChunks.push(payload.transactions.slice(i, i + TX_ROWS_PER_CHUNK));
    }

    const maxMonthlyVal = Math.max(
      1,
      ...payload.monthlyRows.flatMap((m) => [m.income, m.expense])
    );
    const maxCatVal = Math.max(1, ...payload.categories.slice(0, 6).map((c) => c.amount));

    const showChartsBlock =
      (sections.includeMonthlyTrend && payload.monthlyRows.length > 0) ||
      (sections.includeCategories && payload.categories.length > 0);

    return createPortal(
      <div
        id="paisatrack-pdf-capture-root"
        ref={ref}
        style={{
          position: 'fixed',
          left: '-12000px',
          top: 0,
          width: '794px',
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {/* BLOCK 1: Executive Header, Filter Metadata, KPI Summary, Financial Insights */}
        <div
          data-pdf-block="header-insights"
          style={{
            backgroundColor: '#FFFFFF',
            paddingBottom: '12px',
          }}
        >
          {/* Branded Header Banner */}
          <div
            style={{
              backgroundColor: '#101827',
              color: '#FFFFFF',
              padding: '22px 26px',
              borderBottom: '4px solid #7C3AED',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '10px 10px 0 0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#FFFFFF',
                  }}
                >
                  P
                </div>
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                  }}
                >
                  PaisaTrack
                </span>
              </div>
              <p
                style={{
                  margin: '5px 0 0 0',
                  fontSize: '11.5px',
                  color: '#DDD6FE',
                }}
              >
                Your Money. Your Goals. Your Future.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                {payload.sourceTitle}
              </p>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '11px',
                  color: '#94A3B8',
                }}
              >
                Generated {payload.generatedAtDisplay}
              </p>
            </div>
          </div>

          <div style={{ padding: '18px 4px 4px 4px' }}>
            {/* Account & Active Filters Strip */}
            <div
              style={{
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                padding: '12px 16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '5px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                  {payload.accountName}
                  {payload.accountEmail ? ` · ${payload.accountEmail}` : ''}
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#475569',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  Currency: {payload.currency} · {payload.transactions.length} matching records
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
                {activeFilterParts.join('  ·  ')}
              </p>
            </div>

            {/* Executive KPI Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(5, Math.max(1, payload.metrics.length))}, minmax(0, 1fr))`,
                gap: '10px',
                marginBottom: sections.includeInsights && payload.insights.length > 0 ? '18px' : '4px',
              }}
            >
              {payload.metrics.slice(0, 5).map((m) => {
                const valueColor =
                  m.tone === 'positive'
                    ? '#047857'
                    : m.tone === 'negative'
                    ? '#BE123C'
                    : m.tone === 'accent'
                    ? '#6D28D9'
                    : '#0F172A';
                return (
                  <div
                    key={m.label}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      padding: '12px 13px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '10.5px', color: '#64748B', fontWeight: 500 }}>
                      {m.label}
                    </p>
                    <p
                      style={{
                        margin: '5px 0 3px 0',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: payload.metrics.length >= 5 ? '14px' : '16px',
                        fontWeight: 700,
                        color: valueColor,
                      }}
                    >
                      {m.value}
                    </p>
                    {m.note && (
                      <p style={{ margin: 0, fontSize: '10px', color: '#94A3B8' }}>{m.note}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Executive Insights */}
            {sections.includeInsights && payload.insights.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '6px',
                    marginBottom: '10px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    Executive Financial Insights
                  </h3>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                    Computed from filtered dataset
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {payload.insights.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '11.5px',
                        lineHeight: 1.5,
                        color: '#334155',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '9999px',
                          backgroundColor: '#7C3AED',
                          marginTop: '6px',
                          flexShrink: 0,
                        }}
                      />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BLOCK 2: Visual Charts & Category Breakdown */}
        {showChartsBlock && (
          <div
            data-pdf-block="visuals-categories"
            style={{ backgroundColor: '#FFFFFF', padding: '6px 4px 12px 4px' }}
          >
            {/* Visual Charts Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  sections.includeMonthlyTrend &&
                  payload.monthlyRows.length > 0 &&
                  sections.includeCategories &&
                  payload.categories.length > 0
                    ? '1.25fr 1fr'
                    : '1fr',
                gap: '14px',
                marginBottom: sections.includeCategories && payload.categories.length > 0 ? '16px' : '0',
              }}
            >
              {sections.includeMonthlyTrend && payload.monthlyRows.length > 0 && (
                <div
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: '#0F172A',
                      }}
                    >
                      Cash Flow Trend
                    </span>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#475569' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '2px',
                            backgroundColor: '#7C3AED',
                            display: 'inline-block',
                          }}
                        />
                        Income
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '2px',
                            backgroundColor: '#06B6D4',
                            display: 'inline-block',
                          }}
                        />
                        Expenses
                      </span>
                    </div>
                  </div>

                  {/* Crisp Pure-SVG Bar Chart */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      gap: '8px',
                      height: '132px',
                      paddingTop: '14px',
                      borderBottom: '1px solid #CBD5E1',
                    }}
                  >
                    {payload.monthlyRows.slice(-6).map((m) => {
                      const incH = Math.max(4, Math.round((m.income / maxMonthlyVal) * 96));
                      const expH = Math.max(4, Math.round((m.expense / maxMonthlyVal) * 96));
                      return (
                        <div
                          key={m.label}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-end',
                              gap: '3px',
                              height: '100px',
                            }}
                          >
                            <div
                              style={{
                                width: '13px',
                                height: `${incH}px`,
                                backgroundColor: '#7C3AED',
                                borderRadius: '3px 3px 0 0',
                              }}
                            />
                            <div
                              style={{
                                width: '13px',
                                height: `${expH}px`,
                                backgroundColor: '#06B6D4',
                                borderRadius: '3px 3px 0 0',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '9.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {m.label.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sections.includeCategories && payload.categories.length > 0 && (
                <div
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    padding: '14px',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    Top Spending Categories
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {payload.categories.slice(0, 6).map((cat) => {
                      const pctWidth = Math.max(4, Math.round((cat.amount / maxCatVal) * 100));
                      return (
                        <div key={cat.category}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '10.5px',
                              marginBottom: '3px',
                            }}
                          >
                            <span style={{ color: '#1E293B', fontWeight: 600 }}>{cat.category}</span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontVariantNumeric: 'tabular-nums',
                                color: '#334155',
                              }}
                            >
                              {formatCurrency(cat.amount, payload.currency)} ({cat.sharePercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              backgroundColor: '#F1F5F9',
                              borderRadius: '9999px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pctWidth}%`,
                                height: '100%',
                                backgroundColor: cat.color || '#7C3AED',
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Category Breakdown Table */}
            {sections.includeCategories && payload.categories.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    Expense Category Breakdown
                  </h3>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                    {payload.categories.length} active categories
                  </span>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '11px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569' }}>
                        Category
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Entries
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Share
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Total Spend
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.categories.map((cat, idx) => (
                      <tr
                        key={cat.category}
                        style={{
                          backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0F172A' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '2px',
                                backgroundColor: cat.color,
                                display: 'inline-block',
                              }}
                            />
                            {cat.category}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            color: '#475569',
                          }}
                        >
                          {cat.txCount}
                        </td>
                        <td
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            color: '#475569',
                          }}
                        >
                          {cat.sharePercent.toFixed(1)}%
                        </td>
                        <td
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color: '#0F172A',
                          }}
                        >
                          {formatCurrency(cat.amount, payload.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BLOCK 3: Month-over-Month Summary */}
        {sections.includeMonthlyTrend && payload.monthlyRows.length > 0 && (
          <div
            data-pdf-block="monthly-table"
            style={{ backgroundColor: '#FFFFFF', padding: '6px 4px 12px 4px' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderBottom: '1px solid #E2E8F0',
                paddingBottom: '6px',
                marginBottom: '8px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0F172A',
                }}
              >
                Month-over-Month Cash Flow Summary
              </h3>
              <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                {payload.monthlyRows.length} month(s)
              </span>
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '11px',
                border: '1px solid #E2E8F0',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569' }}>Month</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                    Income
                  </th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                    Expenses
                  </th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                    Net Cash Flow
                  </th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                    Savings Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {payload.monthlyRows.map((row, idx) => (
                  <tr
                    key={row.label}
                    style={{
                      backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0F172A' }}>
                      {row.label}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        color: '#047857',
                      }}
                    >
                      {formatCurrency(row.income, payload.currency)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        color: '#1E293B',
                      }}
                    >
                      {formatCurrency(row.expense, payload.currency)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        color: '#0F172A',
                      }}
                    >
                      {formatCurrency(row.net, payload.currency)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        color: '#6D28D9',
                      }}
                    >
                      {row.savingsRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BLOCK 4: Budgets & Goals */}
        {((sections.includeBudgets && payload.budgets.length > 0) ||
          (sections.includeGoals && payload.goals.length > 0)) && (
          <div
            data-pdf-block="budgets-goals"
            style={{ backgroundColor: '#FFFFFF', padding: '6px 4px 12px 4px' }}
          >
            {sections.includeBudgets && payload.budgets.length > 0 && (
              <div style={{ marginBottom: sections.includeGoals && payload.goals.length > 0 ? '16px' : '0' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    Budget Utilization
                  </h3>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                    {payload.budgets.length} tracked limits
                  </span>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '11px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569' }}>
                        Category
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569' }}>
                        Month
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Spent
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Limit
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Remaining
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.budgets.map((b, idx) => {
                      const statusColor =
                        b.pct >= 100 ? '#BE123C' : b.pct >= 75 ? '#B45309' : '#047857';
                      return (
                        <tr
                          key={`${b.category}-${b.month}`}
                          style={{
                            backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                            borderBottom: '1px solid #F1F5F9',
                          }}
                        >
                          <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0F172A' }}>
                            {b.category}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              fontFamily: "'JetBrains Mono', monospace",
                              color: '#475569',
                            }}
                          >
                            {b.month}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontVariantNumeric: 'tabular-nums',
                              color: '#0F172A',
                            }}
                          >
                            {formatCurrency(b.spent, payload.currency)}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontVariantNumeric: 'tabular-nums',
                              color: '#475569',
                            }}
                          >
                            {formatCurrency(b.limit, payload.currency)}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontVariantNumeric: 'tabular-nums',
                              color: '#1E293B',
                            }}
                          >
                            {formatCurrency(b.remaining, payload.currency)}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontWeight: 600,
                              color: statusColor,
                            }}
                          >
                            {b.pct}% · {b.statusLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {sections.includeGoals && payload.goals.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                  >
                    Savings Goals Progress
                  </h3>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                    {payload.goals.length} active goals
                  </span>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '11px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569' }}>Goal</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569' }}>
                        Category
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Saved
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Target
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Funded
                      </th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                        Target Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.goals.map((g, idx) => (
                      <tr
                        key={g.title}
                        style={{
                          backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0F172A' }}>
                          {g.title}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#475569' }}>{g.category}</td>
                        <td
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color: '#047857',
                          }}
                        >
                          {formatCurrency(g.currentAmount, payload.currency)}
                        </td>
                        <td
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            color: '#334155',
                          }}
                        >
                          {formatCurrency(g.targetAmount, payload.currency)}
                        </td>
                        <td
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color: '#6D28D9',
                          }}
                        >
                          {g.pct}%
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                          {formatDateStr(g.targetDate, payload.dateFormat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BLOCK 5+: Paginated Filtered Transaction Ledger */}
        {sections.includeTransactions &&
          (txChunks.length === 0 ? (
            <div
              data-pdf-block="tx-empty"
              style={{ backgroundColor: '#FFFFFF', padding: '6px 4px 12px 4px' }}
            >
              <div
                style={{
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: '6px',
                  marginBottom: '8px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                >
                  Filtered Transaction Ledger
                </h3>
              </div>
              <div
                style={{
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  padding: '18px',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  color: '#64748B',
                }}
              >
                No transactions matched the active filter criteria.
              </div>
            </div>
          ) : (
            txChunks.map((chunk, chunkIdx) => {
              const isFirst = chunkIdx === 0;
              const isLast = chunkIdx === txChunks.length - 1;
              return (
                <div
                  key={`chunk-${chunkIdx}`}
                  data-pdf-block={`tx-chunk-${chunkIdx}`}
                  style={{ backgroundColor: '#FFFFFF', padding: '6px 4px 10px 4px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: '6px',
                      marginBottom: '8px',
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0F172A',
                      }}
                    >
                      {isFirst ? 'Filtered Transaction Ledger' : 'Filtered Transaction Ledger (Continued)'}
                    </h3>
                    <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                      {payload.transactions.length} matching transactions · Section {chunkIdx + 1} of{' '}
                      {txChunks.length}
                    </span>
                  </div>

                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '10.5px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#101827', color: '#FFFFFF' }}>
                        <th style={{ padding: '7px 9px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '7px 9px', textAlign: 'left', fontWeight: 600 }}>
                          Transaction
                        </th>
                        <th style={{ padding: '7px 9px', textAlign: 'left', fontWeight: 600 }}>
                          Category
                        </th>
                        <th style={{ padding: '7px 9px', textAlign: 'left', fontWeight: 600 }}>
                          Method
                        </th>
                        <th style={{ padding: '7px 9px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '7px 9px', textAlign: 'right', fontWeight: 600 }}>
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.map((tx, idx) => (
                        <tr
                          key={tx.id}
                          style={{
                            backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                            borderBottom: '1px solid #F1F5F9',
                          }}
                        >
                          <td
                            style={{
                              padding: '6.5px 9px',
                              color: '#475569',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatDateStr(tx.date, payload.dateFormat)}
                          </td>
                          <td style={{ padding: '6.5px 9px' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{tx.title}</div>
                            {tx.notes && (
                              <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                                {tx.notes}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '6.5px 9px', color: '#334155', whiteSpace: 'nowrap' }}>
                            {tx.category}
                          </td>
                          <td style={{ padding: '6.5px 9px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {tx.paymentMethod}
                          </td>
                          <td
                            style={{
                              padding: '6.5px 9px',
                              color: '#475569',
                              textTransform: 'capitalize',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tx.type}
                          </td>
                          <td
                            style={{
                              padding: '6.5px 9px',
                              textAlign: 'right',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              color: tx.type === 'income' ? '#047857' : '#0F172A',
                            }}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCurrency(tx.amount, payload.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {isLast && (
                      <tfoot>
                        <tr
                          style={{
                            backgroundColor: '#F1F5F9',
                            borderTop: '1px solid #CBD5E1',
                            fontWeight: 700,
                          }}
                        >
                          <td colSpan={4} style={{ padding: '8px 9px', color: '#334155' }}>
                            Net Cash Flow ({payload.transactions.length} entries)
                          </td>
                          <td style={{ padding: '8px 9px', color: '#475569' }}>Net</td>
                          <td
                            style={{
                              padding: '8px 9px',
                              textAlign: 'right',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontVariantNumeric: 'tabular-nums',
                              color: payload.kpisRaw.netCashFlow >= 0 ? '#047857' : '#BE123C',
                            }}
                          >
                            {formatCurrency(payload.kpisRaw.netCashFlow, payload.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              );
            })
          ))}
      </div>,
      document.body
    );
  }
);

PdfCaptureTemplate.displayName = 'PdfCaptureTemplate';
