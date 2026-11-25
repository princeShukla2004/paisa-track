import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Bot,
  Calculator,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogIn,
  MapPin,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Target,
  X,
} from 'lucide-react';
import type { DashboardSection } from '../../types/finance';
import { BrandLogo } from '../ui/BrandLogo';

interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isDemoMode: boolean;
  onOpenAuth: () => void;
  budgetAlertCount?: number;
  budgetAlertSeverity?: 'exceeded' | 'critical' | 'warning' | 'caution' | 'ok';
}

const NAV_ITEMS: Array<{
  id: DashboardSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'budgets', label: 'Budgets', icon: Target },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'goals', label: 'Savings Goals', icon: PiggyBank },
  { id: 'emi', label: 'EMI Calculator', icon: Calculator },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
  { id: 'nearby', label: 'Nearby Finance', icon: MapPin },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  isDemoMode,
  onOpenAuth,
  budgetAlertCount = 0,
  budgetAlertSeverity = 'ok',
}: SidebarProps) {
  const renderNavContent = (isMobile: boolean) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#141d2e] border-r border-slate-200 dark:border-white/10">
        <div
          className={`h-16 px-4 flex items-center border-b border-slate-200 dark:border-white/10 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <BrandLogo showWordmark={!isCollapsed} size="sm" />
          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  if (isMobile) onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={isMobile ? 'sidebarActiveMobile' : 'sidebarActiveDesktop'}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 shadow-md shadow-violet-600/20"
                  />
                )}
                <Icon className="relative z-10 w-4.5 h-4.5 shrink-0" />
                {!isCollapsed && <span className="relative z-10 truncate flex-1 text-left">{item.label}</span>}
                {item.id === 'budgets' && budgetAlertCount > 0 && (
                  isCollapsed ? (
                    <span
                      aria-label={`${budgetAlertCount} budget threshold alerts`}
                      className={`relative z-10 w-2 h-2 rounded-full ${
                        budgetAlertSeverity === 'exceeded'
                          ? 'bg-rose-500'
                          : budgetAlertSeverity === 'critical' || budgetAlertSeverity === 'warning'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                      }`}
                    />
                  ) : (
                    <span
                      aria-label={`${budgetAlertCount} budget threshold alerts`}
                      className={`relative z-10 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : budgetAlertSeverity === 'exceeded'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : budgetAlertSeverity === 'critical' || budgetAlertSeverity === 'warning'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                      }`}
                    >
                      {budgetAlertCount}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>

        {isDemoMode && (
          <div className="p-3 border-t border-slate-200 dark:border-white/10">
            {isCollapsed ? (
              <button
                type="button"
                onClick={onOpenAuth}
                title="Sign in to save your own data"
                className="w-full flex items-center justify-center p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                <LogIn className="w-4 h-4" />
              </button>
            ) : (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5">
                <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  Interactive Demo Preview
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Sample portfolio data. Sign in to persist your own finances securely.
                </p>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
                >
                  Sign In / Create Account
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[76px]' : 'w-[256px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderNavContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="relative z-10 w-72 h-full"
            >
              {renderNavContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
