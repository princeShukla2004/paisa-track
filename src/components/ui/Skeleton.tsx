import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5"
          >
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
            <div className="mt-4 h-7 w-32 rounded bg-slate-200 dark:bg-white/10" />
            <div className="mt-5 h-6 w-full rounded bg-slate-100 dark:bg-white/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-80 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6" />
        <div className="h-80 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6" />
      </div>
      <div className="h-64 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-6" />
    </div>
  );
}
