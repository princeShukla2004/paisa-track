import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { CURRENCY_META, type CurrencyCode, type DashboardSection } from '../../types/finance';
import { formatCurrency, formatDateStr } from '../../lib/formatters';
import { ProfileAvatar } from '../ui/ProfileAvatar';

interface TopBarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  onOpenMobileMenu: () => void;
  onOpenAuth: () => void;
}

const SECTION_TITLES: Record<DashboardSection, string> = {
  overview: 'Financial Overview',
  transactions: 'Transactions',
  recurring: 'Recurring Transactions',
  budgets: 'Smart Budgets',
  analytics: 'Advanced Analytics',
  goals: 'Savings Goals',
  emi: 'EMI Calculator',
  assistant: 'AI Financial Assistant',
  nearby: 'Nearby Banks & Advisors',
  settings: 'Settings & Profile',
};

export function TopBar({
  activeSection,
  onSelectSection,
  onOpenMobileMenu,
  onOpenAuth,
}: TopBarProps) {
  const { user, isDemoMode, logout } = useAuth();
  const {
    profile,
    settings,
    theme,
    setTheme,
    setCurrency,
    transactions,
    budgets,
    goals,
    notifications,
    budgetAlerts,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { txs: [], budgets: [], goals: [] };
    return {
      txs: transactions
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.paymentMethod.toLowerCase().includes(q)
        )
        .slice(0, 4),
      budgets: budgets
        .filter((b) => b.category.toLowerCase().includes(q))
        .slice(0, 2),
      goals: goals
        .filter((g) => g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
        .slice(0, 2),
    };
  }, [searchQuery, transactions, budgets, goals]);

  const hasSearchResults =
    searchResults.txs.length > 0 || searchResults.budgets.length > 0 || searchResults.goals.length > 0;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeAlertCount = settings.budgetAlertsEnabled ? budgetAlerts.length : 0;
  const badgeCount = unreadCount > 0 ? unreadCount : activeAlertCount;
  const hasUrgentBudgetAlert =
    settings.budgetAlertsEnabled && budgetAlerts.some((a) => a.threshold >= 90);
  const displayName = isDemoMode
    ? profile?.displayName || 'Prince Kumar'
    : profile?.displayName || user?.displayName || 'PaisaTrack User';
  const avatarUrl = isDemoMode ? '' : profile?.photoURL || user?.photoURL || '';

  return (
    <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#101827]/90 backdrop-blur-md flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      {/* Global Search */}
      <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search transactions, budgets, goals..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#192438] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        <AnimatePresence>
          {searchOpen && searchQuery.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] shadow-2xl p-2 z-50"
            >
              {!hasSearchResults ? (
                <p className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  No matching records found for “{searchQuery}”.
                </p>
              ) : (
                <div className="space-y-1">
                  {searchResults.txs.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => {
                        onSelectSection('transactions');
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {tx.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tx.category} · {formatDateStr(tx.date, settings.dateFormat)}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold tabular-nums ${
                          tx.type === 'income' ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount, settings.currency)}
                      </span>
                    </button>
                  ))}
                  {searchResults.budgets.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        onSelectSection('budgets');
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        Budget: {b.category}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatCurrency(b.limit, settings.currency)}
                      </span>
                    </button>
                  ))}
                  {searchResults.goals.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        onSelectSection('goals');
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        Goal: {g.title}
                      </span>
                      <span className="text-xs font-mono text-cyan-500 tabular-nums">
                        {formatCurrency(g.currentAmount, settings.currency)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Currency Selector */}
        <select
          aria-label="Select display currency"
          value={settings.currency}
          onChange={(e) => void setCurrency(e.target.value as CurrencyCode)}
          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#192438] text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        >
          {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
            <option key={code} value={code}>
              {CURRENCY_META[code].label}
            </option>
          ))}
        </select>

        {/* Animated Theme Toggle */}
        <button
          type="button"
          onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#192438] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <motion.div
            key={theme}
            initial={{ rotate: -30, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-600" />}
          </motion.div>
        </button>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Open notifications"
            className="relative p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#192438] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {badgeCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center tabular-nums ${
                  hasUrgentBudgetAlert ? 'bg-rose-500' : 'bg-violet-600'
                }`}
              >
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Notifications ({unreadCount} unread)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {settings.budgetAlertsEnabled && budgetAlerts.length > 0 && (
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#101827]/70 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        Active Budget Thresholds
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {budgetAlerts
                          .slice(0, 3)
                          .map((a) => `${a.category} ${Math.round(a.pct)}%`)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onSelectSection('budgets');
                      }}
                      className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline shrink-0"
                    >
                      View Budgets
                    </button>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No financial alerts yet. Budget thresholds (50%, 75%, 90%, 100%), goal deadlines, and EMI reminders appear here automatically.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 flex items-start justify-between gap-3 ${
                          !n.read ? 'bg-violet-500/[0.04]' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {n.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => void markNotificationRead(n.id)}
                              title="Mark read"
                              className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-500/10"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteNotification(n.id)}
                            title="Dismiss"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#192438] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ProfileAvatar name={displayName} photoURL={avatarUrl} size="sm" />
            <span className="hidden sm:inline text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[130px] truncate">
              {displayName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] shadow-2xl p-1.5 z-50"
              >
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/10 flex items-center gap-2.5">
                  <ProfileAvatar name={displayName} photoURL={avatarUrl} size="md" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {settings.email || user?.email || 'Demo Account'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('settings');
                    setProfileOpen(false);
                  }}
                  className="w-full mt-1 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings &amp; Profile
                </button>
                {isDemoMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAuth();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    Sign In to Save Data
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    void logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isDemoMode ? 'Exit Demo Preview' : 'Sign Out'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
