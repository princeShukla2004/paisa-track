import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { DashboardSection } from '../../types/finance';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { OverviewView } from './OverviewView';
import { TransactionsView } from './TransactionsView';
import { RecurringTransactionsView } from './RecurringTransactionsView';
import { BudgetsView } from './BudgetsView';
import { AnalyticsView } from './AnalyticsView';
import { GoalsView } from './GoalsView';
import { EmiCalculatorView } from './EmiCalculatorView';
import { AiAssistantView } from './AiAssistantView';
import { NearbyFinanceMapView } from './NearbyFinanceMapView';
import { SettingsView } from './SettingsView';
import { TransactionModal } from './TransactionModal';

interface DashboardWorkspaceProps {
  onOpenAuth: () => void;
}

export function DashboardWorkspace({ onOpenAuth }: DashboardWorkspaceProps) {
  const { isDemoMode } = useAuth();
  const { budgetAlerts, settings } = useFinance();
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickTxModalOpen, setQuickTxModalOpen] = useState(false);

  const activeBudgetAlertCount = settings.budgetAlertsEnabled ? budgetAlerts.length : 0;
  const topBudgetSeverity = budgetAlerts[0]?.severity ?? 'ok';

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#101827] text-slate-900 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isDemoMode={isDemoMode}
        onOpenAuth={onOpenAuth}
        budgetAlertCount={activeBudgetAlertCount}
        budgetAlertSeverity={topBudgetSeverity}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAuth={onOpenAuth}
        />

        {isDemoMode && (
          <div className="no-print px-4 sm:px-6 py-2 bg-cyan-500/10 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-cyan-800 dark:text-cyan-300 font-medium">
              Viewing Interactive Demo Workspace (Sample Portfolio Data — changes here are session-only)
            </span>
            <button
              type="button"
              onClick={onOpenAuth}
              className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Sign in to save your real finances →
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeSection === 'overview' && (
                <OverviewView
                  onNavigate={setActiveSection}
                  onQuickAddTransaction={() => setQuickTxModalOpen(true)}
                />
              )}
              {activeSection === 'transactions' && <TransactionsView />}
              {activeSection === 'recurring' && <RecurringTransactionsView />}
              {activeSection === 'budgets' && <BudgetsView />}
              {activeSection === 'analytics' && <AnalyticsView />}
              {activeSection === 'goals' && <GoalsView />}
              {activeSection === 'emi' && <EmiCalculatorView />}
              {activeSection === 'assistant' && <AiAssistantView />}
              {activeSection === 'nearby' && <NearbyFinanceMapView />}
              {activeSection === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <TransactionModal
        open={quickTxModalOpen}
        onClose={() => setQuickTxModalOpen(false)}
      />
    </div>
  );
}
