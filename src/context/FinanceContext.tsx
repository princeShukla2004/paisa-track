import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  BUDGET_CATEGORIES,
  FIELD_LIMITS,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  TRANSACTION_CATEGORIES,
  type BudgetCategory,
  type BudgetRecord,
  type CurrencyCode,
  type DateFormatOption,
  type EmiPlanRecord,
  type LoanType,
  type NotificationRecord,
  type PaymentMethod,
  type RecurringFrequency,
  type RecurringTransactionRecord,
  type SavingsContributionRecord,
  type SavingsGoalRecord,
  type ThemeMode,
  type TransactionCategory,
  type TransactionRecord,
  type TransactionType,
  type UserProfile,
  type UserSettings,
} from '../types/finance';
import {
  createDemoBudgets,
  createDemoContributions,
  createDemoEmiPlans,
  createDemoGoals,
  createDemoNotifications,
  createDemoRecurringTransactions,
  createDemoTransactions,
  DEMO_PROFILE,
  DEMO_SETTINGS,
  DEMO_USER_ID,
} from '../data/demoData';
import { formatCurrency, toIsoDate, toMonthKey } from '../lib/formatters';
import { collectDueOccurrences, computeNextDueDate } from '../lib/recurringSchedule';
import {
  buildBudgetAlertCopy,
  evaluateBudgetAlerts,
  type BudgetAlertStatus,
} from '../lib/budgetAlerts';

interface TransactionInput {
  title: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

interface BudgetInput {
  category: BudgetCategory;
  limit: number;
  month: string;
  notes?: string;
}

interface GoalInput {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate: string;
  category: string;
  notes?: string;
}

interface EmiPlanInput {
  title: string;
  loanType: LoanType;
  principal: number;
  annualRate: number;
  tenureMonths: number;
  dueDay: number;
  reminderEnabled: boolean;
}

export interface RecurringTransactionInput {
  title: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  startDate: string;
  nextDueDate?: string;
  active: boolean;
  notes?: string;
}

interface FinanceContextValue {
  loading: boolean;
  profile: UserProfile | null;
  settings: UserSettings;
  transactions: TransactionRecord[];
  recurringTransactions: RecurringTransactionRecord[];
  budgets: BudgetRecord[];
  goals: SavingsGoalRecord[];
  contributions: SavingsContributionRecord[];
  notifications: NotificationRecord[];
  budgetAlerts: BudgetAlertStatus[];
  emiPlans: EmiPlanRecord[];
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  updateProfileInfo: (displayName: string, photoURL?: string) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  importTransactionsBatch: (items: TransactionInput[]) => Promise<number>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addRecurringTransaction: (input: RecurringTransactionInput) => Promise<void>;
  updateRecurringTransaction: (id: string, input: RecurringTransactionInput) => Promise<void>;
  toggleRecurringTransaction: (id: string, active: boolean) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  triggerRecurringNow: (id: string) => Promise<void>;
  processDueRecurringTransactions: (silentIfNone?: boolean) => Promise<number>;
  addBudget: (input: BudgetInput) => Promise<void>;
  updateBudget: (id: string, input: BudgetInput) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (id: string, input: GoalInput) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addGoalContribution: (goalId: string, amount: number, date: string, notes?: string) => Promise<void>;
  addEmiPlan: (input: EmiPlanInput) => Promise<void>;
  deleteEmiPlan: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  loadSamplePortfolio: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  deleteAllUserAccountData: () => Promise<void>;
}

const DEFAULT_SETTINGS: UserSettings = {
  userId: '',
  email: '',
  currency: 'INR',
  dateFormat: 'DD MMM YYYY',
  theme: 'dark',
  notificationsEnabled: true,
  budgetAlertsEnabled: true,
  goalRemindersEnabled: true,
  unusualSpendingEnabled: true,
  monthlySummaryEnabled: true,
  emiRemindersEnabled: true,
  onboardingCompleted: false,
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

function clampAmount(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(Math.round(num * 100) / 100, FIELD_LIMITS.AMOUNT_MAX);
}

function sanitizeCategory(cat: string): TransactionCategory {
  return (TRANSACTION_CATEGORIES as readonly string[]).includes(cat)
    ? (cat as TransactionCategory)
    : 'Other';
}

function sanitizeBudgetCategory(cat: string): BudgetCategory {
  return (BUDGET_CATEGORIES as readonly string[]).includes(cat)
    ? (cat as BudgetCategory)
    : 'Other';
}

function sanitizePaymentMethod(pm: string): PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(pm) ? (pm as PaymentMethod) : 'Other';
}

function sanitizeDateIso(dateStr: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : toIsoDate(new Date());
}

function sanitizeMonthIso(monthStr: string): string {
  return /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : toMonthKey(toIsoDate(new Date()));
}

function sanitizeFrequency(freq: string): RecurringFrequency {
  return (RECURRING_FREQUENCIES as readonly string[]).includes(freq)
    ? (freq as RecurringFrequency)
    : 'monthly';
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isDemoMode, updateUserDisplay, deleteAuthAccount } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [localTheme, setLocalTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('paisatrack_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    }
    return 'dark';
  });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransactionRecord[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [goals, setGoals] = useState<SavingsGoalRecord[]>([]);
  const [contributions, setContributions] = useState<SavingsContributionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [emiPlans, setEmiPlans] = useState<EmiPlanRecord[]>([]);

  const [txLoaded, setTxLoaded] = useState(false);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);

  const evaluatedKeysRef = useRef<Set<string>>(new Set());
  const budgetBaselineReadyRef = useRef(false);
  const prevBudgetThresholdRef = useRef<Map<string, number>>(new Map());
  const recurringInFlightRef = useRef(false);
  const transactionsRef = useRef<TransactionRecord[]>([]);
  const recurringRef = useRef<RecurringTransactionRecord[]>([]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    recurringRef.current = recurringTransactions;
  }, [recurringTransactions]);

  if (fatalError) {
    throw fatalError;
  }

  // Sync theme to document root
  useEffect(() => {
    const activeTheme = user || isDemoMode ? settings.theme : localTheme;
    const root = document.documentElement;
    if (activeTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('paisatrack_theme', activeTheme);
    } catch {
      // ignore storage failure
    }
  }, [localTheme, settings.theme, user, isDemoMode]);

  // Load demo mode OR Firestore real-time listeners
  useEffect(() => {
    if (!authReady) return;

    if (isDemoMode) {
      setProfile(DEMO_PROFILE);
      setSettings(DEMO_SETTINGS);
      setTransactions(createDemoTransactions(DEMO_USER_ID));
      setRecurringTransactions(createDemoRecurringTransactions(DEMO_USER_ID));
      setBudgets(createDemoBudgets(DEMO_USER_ID));
      setGoals(createDemoGoals(DEMO_USER_ID));
      setContributions(createDemoContributions(DEMO_USER_ID));
      setNotifications(createDemoNotifications(DEMO_USER_ID));
      setEmiPlans(createDemoEmiPlans(DEMO_USER_ID));
      setTxLoaded(true);
      setRecurringLoaded(true);
      setBudgetsLoaded(true);
      budgetBaselineReadyRef.current = false;
      prevBudgetThresholdRef.current.clear();
      evaluatedKeysRef.current.clear();
      setLoading(false);
      return;
    }

    if (!user || !user.emailVerified) {
      setProfile(null);
      setSettings({ ...DEFAULT_SETTINGS, theme: localTheme });
      setTransactions([]);
      setRecurringTransactions([]);
      setBudgets([]);
      setGoals([]);
      setContributions([]);
      setNotifications([]);
      setEmiPlans([]);
      setTxLoaded(false);
      setRecurringLoaded(false);
      setBudgetsLoaded(false);
      budgetBaselineReadyRef.current = false;
      prevBudgetThresholdRef.current.clear();
      evaluatedKeysRef.current.clear();
      setLoading(false);
      return;
    }

    setLoading(true);
    setTxLoaded(false);
    setRecurringLoaded(false);
    setBudgetsLoaded(false);
    budgetBaselineReadyRef.current = false;
    prevBudgetThresholdRef.current.clear();
    evaluatedKeysRef.current.clear();
    const uid = user.uid;
    let active = true;
    const unsubs: Array<() => void> = [];

    async function bootstrapUserAndSubscribe() {
      try {
        const userRef = doc(db, 'users', uid);
        const settingsRef = doc(db, 'users', uid, 'private', 'settings');
        const [userSnap, settingsSnap] = await Promise.all([
          getDoc(userRef),
          getDoc(settingsRef),
        ]);

        if (!userSnap.exists() || !settingsSnap.exists()) {
          const batch = writeBatch(db);
          if (!userSnap.exists()) {
            const profilePayload: Record<string, unknown> = {
              uid,
              displayName: (user?.displayName || user?.email?.split('@')[0] || 'PaisaTrack User').slice(
                0,
                FIELD_LIMITS.DISPLAY_NAME_MAX
              ),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            if (user?.photoURL) {
              profilePayload.photoURL = user.photoURL.slice(0, FIELD_LIMITS.PHOTO_URL_MAX);
            }
            batch.set(userRef, profilePayload);
          }

          if (!settingsSnap.exists()) {
            batch.set(settingsRef, {
              userId: uid,
              email: (user?.email || 'user@paisatrack.app').slice(0, FIELD_LIMITS.EMAIL_MAX),
              currency: 'INR',
              dateFormat: 'DD MMM YYYY',
              theme: localTheme,
              notificationsEnabled: true,
              budgetAlertsEnabled: true,
              goalRemindersEnabled: true,
              unusualSpendingEnabled: true,
              monthlySummaryEnabled: true,
              emiRemindersEnabled: true,
              onboardingCompleted: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        } catch (wrapped) {
          if (active) setFatalError(wrapped as Error);
        }
        return;
      }

      if (!active) return;

      const userPath = `users/${uid}`;
      unsubs.push(
        onSnapshot(
          doc(db, 'users', uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            }
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.GET, userPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const settingsPath = `users/${uid}/private/settings`;
      unsubs.push(
        onSnapshot(
          doc(db, 'users', uid, 'private', 'settings'),
          (snap) => {
            if (snap.exists()) {
              setSettings(snap.data() as UserSettings);
            }
            setLoading(false);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.GET, settingsPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const txPath = `users/${uid}/transactions`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'transactions'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<TransactionRecord, 'id'>) }))
              .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
            setTransactions(list);
            setTxLoaded(true);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, txPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const recurringPath = `users/${uid}/recurring_transactions`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'recurring_transactions'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<RecurringTransactionRecord, 'id'>) }))
              .sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : 0));
            setRecurringTransactions(list);
            setRecurringLoaded(true);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, recurringPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const budgetsPath = `users/${uid}/budgets`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'budgets'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<BudgetRecord, 'id'>),
            }));
            setBudgets(list);
            setBudgetsLoaded(true);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, budgetsPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const goalsPath = `users/${uid}/savings_goals`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'savings_goals'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SavingsGoalRecord, 'id'>),
            }));
            setGoals(list);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, goalsPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const contribPath = `users/${uid}/savings_contributions`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'savings_contributions'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({
                id: d.id,
                ...(d.data() as Omit<SavingsContributionRecord, 'id'>),
              }))
              .sort((a, b) => (a.date < b.date ? 1 : -1));
            setContributions(list);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, contribPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const notifPath = `users/${uid}/notifications`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'notifications'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<NotificationRecord, 'id'>),
            }));
            setNotifications(list.reverse());
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, notifPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );

      const emiPath = `users/${uid}/emi_plans`;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'emi_plans'), where('userId', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<EmiPlanRecord, 'id'>),
            }));
            setEmiPlans(list);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, emiPath);
            } catch (wrapped) {
              setFatalError(wrapped as Error);
            }
          }
        )
      );
    }

    void bootstrapUserAndSubscribe();

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, isDemoMode]);

  // Current-month active category budget alerts (50%, 75%, 90%, 100%+) for real-time dashboard badges
  const budgetAlerts = useMemo<BudgetAlertStatus[]>(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return evaluateBudgetAlerts(budgets, transactions, currentMonth).filter(
      (status) => status.threshold >= 50
    );
  }, [budgets, transactions]);

  // Real-time category budget threshold watcher (works in both Demo & Authenticated workspaces)
  useEffect(() => {
    if (loading || !txLoaded || !budgetsLoaded) return;
    if (!isDemoMode && (!user || !user.emailVerified)) return;

    const statuses = evaluateBudgetAlerts(budgets, transactions);
    const nextMap = new Map<string, number>();
    for (const status of statuses) {
      nextMap.set(`${status.budgetId}_${status.month}`, status.threshold);
    }

    // Establish initial baseline on workspace load so we don't blast toasts for pre-existing state
    if (!budgetBaselineReadyRef.current) {
      prevBudgetThresholdRef.current = nextMap;
      budgetBaselineReadyRef.current = true;

      // For authenticated users, still backfill any missing Firestore budget notifications quietly
      if (
        !isDemoMode &&
        user &&
        user.emailVerified &&
        settings.notificationsEnabled &&
        settings.budgetAlertsEnabled
      ) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const existingKeys = new Set(notifications.map((n) => n.dedupeKey).filter(Boolean));
        const backfill = statuses
          .filter(
            (s) =>
              s.month === currentMonth &&
              s.threshold >= 50 &&
              !existingKeys.has(s.dedupeKey) &&
              !evaluatedKeysRef.current.has(s.dedupeKey)
          )
          .slice(0, 4);

        if (backfill.length > 0) {
          backfill.forEach((s) => evaluatedKeysRef.current.add(s.dedupeKey));
          const uid = user.uid;
          void (async () => {
            try {
              const batch = writeBatch(db);
              for (const s of backfill) {
                const copy = buildBudgetAlertCopy(s, settings.currency);
                const ref = doc(collection(db, 'users', uid, 'notifications'));
                batch.set(ref, {
                  userId: uid,
                  title: copy.title,
                  message: copy.message,
                  type: 'budget',
                  read: false,
                  dedupeKey: s.dedupeKey.slice(0, 120),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              await batch.commit();
            } catch {
              // Non-blocking alert sync
            }
          })();
        }
      }
      return;
    }

    if (!settings.notificationsEnabled || !settings.budgetAlertsEnabled) {
      prevBudgetThresholdRef.current = nextMap;
      return;
    }

    const newlyCrossed: BudgetAlertStatus[] = [];
    for (const status of statuses) {
      if (status.threshold < 50) continue;
      const mapKey = `${status.budgetId}_${status.month}`;
      const prevThreshold = prevBudgetThresholdRef.current.get(mapKey) ?? 0;
      if (status.threshold > prevThreshold) {
        newlyCrossed.push(status);
      }
    }

    prevBudgetThresholdRef.current = nextMap;

    if (newlyCrossed.length === 0) return;

    // Emit live toast messages (up to 3 simultaneous toasts to keep UI crisp)
    newlyCrossed.slice(0, 3).forEach((status) => {
      const copy = buildBudgetAlertCopy(status, settings.currency);
      showToast(copy.title, {
        description: copy.message,
        variant: copy.variant,
      });
    });

    const existingKeys = new Set(notifications.map((n) => n.dedupeKey).filter(Boolean));
    const toPersist = newlyCrossed.filter(
      (s) => !existingKeys.has(s.dedupeKey) && !evaluatedKeysRef.current.has(s.dedupeKey)
    );

    if (toPersist.length === 0) return;
    toPersist.forEach((s) => evaluatedKeysRef.current.add(s.dedupeKey));

    if (isDemoMode) {
      const nowIso = new Date().toISOString();
      const demoItems: NotificationRecord[] = toPersist.map((s) => {
        const copy = buildBudgetAlertCopy(s, settings.currency);
        return {
          id: `demo_notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId: DEMO_USER_ID,
          title: copy.title,
          message: copy.message,
          type: 'budget',
          read: false,
          dedupeKey: s.dedupeKey,
          createdAt: nowIso,
        };
      });
      setNotifications((prev) => [...demoItems, ...prev]);
      return;
    }

    if (user && user.emailVerified) {
      const uid = user.uid;
      void (async () => {
        try {
          const batch = writeBatch(db);
          for (const s of toPersist) {
            const copy = buildBudgetAlertCopy(s, settings.currency);
            const ref = doc(collection(db, 'users', uid, 'notifications'));
            batch.set(ref, {
              userId: uid,
              title: copy.title,
              message: copy.message,
              type: 'budget',
              read: false,
              dedupeKey: s.dedupeKey.slice(0, 120),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch {
          // Non-blocking alert sync
        }
      })();
    }
  }, [
    loading,
    txLoaded,
    budgetsLoaded,
    isDemoMode,
    user,
    budgets,
    transactions,
    notifications,
    settings.notificationsEnabled,
    settings.budgetAlertsEnabled,
    settings.currency,
    showToast,
  ]);

  // Automated smart alerts evaluator for authenticated users (unusual spend, goals, EMI)
  useEffect(() => {
    if (!user || !user.emailVerified || isDemoMode || loading || !settings.notificationsEnabled) {
      return;
    }
    if (transactions.length === 0 && budgets.length === 0 && goals.length === 0 && emiPlans.length === 0) {
      return;
    }

    const uid = user.uid;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const existingKeys = new Set(notifications.map((n) => n.dedupeKey).filter(Boolean));

    const candidates: Array<{
      dedupeKey: string;
      title: string;
      message: string;
      type: NotificationRecord['type'];
    }> = [];

    // 2. Unusual spending alert (>35% jump vs previous month in any category >= 1000)
    if (settings.unusualSpendingEnabled) {
      const curTotals: Record<string, number> = {};
      const prevTotals: Record<string, number> = {};
      for (const t of transactions) {
        if (t.type !== 'expense') continue;
        if (t.date.startsWith(currentMonth)) curTotals[t.category] = (curTotals[t.category] || 0) + t.amount;
        if (t.date.startsWith(prevMonth)) prevTotals[t.category] = (prevTotals[t.category] || 0) + t.amount;
      }
      for (const cat of Object.keys(curTotals)) {
        const cur = curTotals[cat];
        const prev = prevTotals[cat] || 0;
        if (prev > 0 && cur > prev * 1.35) {
          const pctMore = Math.round(((cur - prev) / prev) * 100);
          const key = `unusual_${cat}_${currentMonth}_${pctMore >= 50 ? '50' : '35'}`;
          if (!existingKeys.has(key) && !evaluatedKeysRef.current.has(key)) {
            candidates.push({
              dedupeKey: key,
              title: `Higher ${cat} Spending (+${pctMore}%)`,
              message: `You spent ${formatCurrency(cur, settings.currency)} on ${cat} this month vs ${formatCurrency(
                prev,
                settings.currency
              )} last month.`,
              type: 'unusual',
            });
          }
        }
      }
    }

    // 3. Goal reminders (within 30 days and < 100% funded)
    if (settings.goalRemindersEnabled) {
      for (const g of goals) {
        if (g.currentAmount >= g.targetAmount) continue;
        const targetTime = new Date(g.targetDate).getTime();
        const daysLeft = Math.ceil((targetTime - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 30) {
          const key = `goal_due_${g.id}_${currentMonth}`;
          if (!existingKeys.has(key) && !evaluatedKeysRef.current.has(key)) {
            candidates.push({
              dedupeKey: key,
              title: `Goal Deadline Approaching: ${g.title}`,
              message: `${daysLeft} days left to reach ${formatCurrency(
                g.targetAmount,
                settings.currency
              )}. Remaining: ${formatCurrency(g.targetAmount - g.currentAmount, settings.currency)}.`,
              type: 'goal',
            });
          }
        }
      }
    }

    // 4. Upcoming EMI reminders (due within 5 days)
    if (settings.emiRemindersEnabled) {
      const todayDay = now.getDate();
      for (const plan of emiPlans) {
        if (!plan.reminderEnabled) continue;
        const diff = plan.dueDay >= todayDay ? plan.dueDay - todayDay : 30 - todayDay + plan.dueDay;
        if (diff <= 5) {
          const key = `emi_due_${plan.id}_${currentMonth}`;
          if (!existingKeys.has(key) && !evaluatedKeysRef.current.has(key)) {
            candidates.push({
              dedupeKey: key,
              title: `Upcoming EMI: ${plan.title}`,
              message: `Your ${plan.loanType} installment is scheduled around day ${plan.dueDay} of this month.`,
              type: 'emi',
            });
          }
        }
      }
    }

    if (candidates.length === 0) return;

    const toCreate = candidates.slice(0, 3);
    toCreate.forEach((c) => evaluatedKeysRef.current.add(c.dedupeKey));

    void (async () => {
      try {
        const batch = writeBatch(db);
        for (const item of toCreate) {
          const ref = doc(collection(db, 'users', uid, 'notifications'));
          batch.set(ref, {
            userId: uid,
            title: item.title.slice(0, 120),
            message: item.message.slice(0, 400),
            type: item.type,
            read: false,
            dedupeKey: item.dedupeKey.slice(0, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch {
        // Non-blocking alert sync
      }
    })();
  }, [user, isDemoMode, loading, settings, transactions, budgets, goals, emiPlans, notifications]);

  const activeTheme = user || isDemoMode ? settings.theme : localTheme;

  const updateSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      const next: UserSettings = { ...settings, ...partial };
      setSettings(next);
      if (partial.theme) setLocalTheme(partial.theme);

      if (isDemoMode || !user || !user.emailVerified) return;

      const settingsPath = `users/${user.uid}/private/settings`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
          email: (next.email || user.email || 'user@paisatrack.app').slice(0, FIELD_LIMITS.EMAIL_MAX),
          ...(next.phone ? { phone: next.phone.slice(0, FIELD_LIMITS.PHONE_MAX) } : { phone: '' }),
          currency: next.currency,
          dateFormat: next.dateFormat,
          theme: next.theme,
          notificationsEnabled: Boolean(next.notificationsEnabled),
          budgetAlertsEnabled: Boolean(next.budgetAlertsEnabled),
          goalRemindersEnabled: Boolean(next.goalRemindersEnabled),
          unusualSpendingEnabled: Boolean(next.unusualSpendingEnabled),
          monthlySummaryEnabled: Boolean(next.monthlySummaryEnabled),
          emiRemindersEnabled: Boolean(next.emiRemindersEnabled),
          onboardingCompleted: Boolean(next.onboardingCompleted),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, settingsPath);
      }
    },
    [settings, isDemoMode, user]
  );

  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      setLocalTheme(theme);
      await updateSettings({ theme });
    },
    [updateSettings]
  );

  const setCurrency = useCallback(
    async (currency: CurrencyCode) => {
      await updateSettings({ currency });
    },
    [updateSettings]
  );

  const updateProfileInfo = useCallback(
    async (displayName: string, photoURL?: string) => {
      const cleanName = displayName.trim().slice(0, FIELD_LIMITS.DISPLAY_NAME_MAX);
      if (!cleanName) throw new Error('Display name cannot be empty.');
      const cleanPhoto = photoURL?.trim().slice(0, FIELD_LIMITS.PHOTO_URL_MAX);

      if (isDemoMode) {
        setProfile((prev) =>
          prev
            ? { ...prev, displayName: cleanName, ...(cleanPhoto !== undefined ? { photoURL: cleanPhoto } : {}) }
            : prev
        );
        showToast('Profile updated in demo preview', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}`;
      try {
        await updateUserDisplay(cleanName, cleanPhoto);
        const payload: Record<string, unknown> = {
          displayName: cleanName,
          updatedAt: serverTimestamp(),
        };
        if (cleanPhoto !== undefined) {
          payload.photoURL = cleanPhoto;
        }
        await updateDoc(doc(db, 'users', user.uid), payload);
        showToast('Profile updated', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user, updateUserDisplay, showToast]
  );

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      const amount = clampAmount(input.amount);
      const title = input.title.trim().slice(0, FIELD_LIMITS.TX_TITLE_MAX);
      if (!title || amount <= 0) {
        throw new Error('Please enter a valid title and positive amount.');
      }
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.TX_NOTES_MAX);

      if (isDemoMode) {
        const record: TransactionRecord = {
          id: `demo_tx_${Date.now()}`,
          userId: DEMO_USER_ID,
          title,
          amount,
          type: input.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(input.category),
          date: sanitizeDateIso(input.date),
          paymentMethod: sanitizePaymentMethod(input.paymentMethod),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        };
        setTransactions((prev) => [record, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
        showToast('Transaction added', { description: `${title} recorded`, variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) throw new Error('Verified sign-in required.');
      const path = `users/${user.uid}/transactions`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), {
          userId: user.uid,
          title,
          amount,
          type: input.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(input.category),
          date: sanitizeDateIso(input.date),
          paymentMethod: sanitizePaymentMethod(input.paymentMethod),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Transaction saved', { description: title, variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const importTransactionsBatch = useCallback(
    async (items: TransactionInput[]): Promise<number> => {
      const validItems = items
        .map((it) => ({
          title: it.title.trim().slice(0, FIELD_LIMITS.TX_TITLE_MAX),
          amount: clampAmount(it.amount),
          type: (it.type === 'income' ? 'income' : 'expense') as TransactionType,
          category: sanitizeCategory(it.category),
          date: sanitizeDateIso(it.date),
          paymentMethod: sanitizePaymentMethod(it.paymentMethod),
          notes: it.notes?.trim().slice(0, FIELD_LIMITS.TX_NOTES_MAX),
        }))
        .filter((it) => it.title.length > 0 && it.amount > 0);

      if (validItems.length === 0) return 0;

      if (isDemoMode) {
        const added: TransactionRecord[] = validItems.map((it, idx) => ({
          id: `demo_csv_${Date.now()}_${idx}`,
          userId: DEMO_USER_ID,
          ...it,
          ...(it.notes ? { notes: it.notes } : {}),
        }));
        setTransactions((prev) => [...added, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
        return added.length;
      }

      if (!user || !user.emailVerified) throw new Error('Verified sign-in required.');
      const path = `users/${user.uid}/transactions`;
      try {
        // Chunk in batches of 400 to stay under Firestore 500-op batch limit
        for (let i = 0; i < validItems.length; i += 400) {
          const chunk = validItems.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const item of chunk) {
            const ref = doc(collection(db, 'users', user.uid, 'transactions'));
            batch.set(ref, {
              userId: user.uid,
              title: item.title,
              amount: item.amount,
              type: item.type,
              category: item.category,
              date: item.date,
              paymentMethod: item.paymentMethod,
              ...(item.notes ? { notes: item.notes } : {}),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
        return validItems.length;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [isDemoMode, user]
  );

  const updateTransaction = useCallback(
    async (id: string, input: TransactionInput) => {
      const amount = clampAmount(input.amount);
      const title = input.title.trim().slice(0, FIELD_LIMITS.TX_TITLE_MAX);
      if (!title || amount <= 0) {
        throw new Error('Please enter a valid title and positive amount.');
      }
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.TX_NOTES_MAX) ?? '';

      if (isDemoMode) {
        setTransactions((prev) =>
          prev
            .map((t) =>
              t.id === id
                ? {
                    ...t,
                    title,
                    amount,
                    type: (input.type === 'income' ? 'income' : 'expense') as TransactionType,
                    category: sanitizeCategory(input.category),
                    date: sanitizeDateIso(input.date),
                    paymentMethod: sanitizePaymentMethod(input.paymentMethod),
                    notes: cleanNotes,
                  }
                : t
            )
            .sort((a, b) => (a.date < b.date ? 1 : -1))
        );
        showToast('Transaction updated', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/transactions/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', id), {
          title,
          amount,
          type: input.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(input.category),
          date: sanitizeDateIso(input.date),
          paymentMethod: sanitizePaymentMethod(input.paymentMethod),
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        });
        showToast('Transaction updated', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        showToast('Transaction deleted', { variant: 'info' });
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/transactions/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
        showToast('Transaction deleted', { variant: 'info' });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const processDueRecurringTransactions = useCallback(
    async (silentIfNone = true): Promise<number> => {
      if (recurringInFlightRef.current) return 0;
      const todayIso = toIsoDate(new Date());
      const dueRules = recurringRef.current.filter(
        (rec) => rec.active && rec.nextDueDate <= todayIso
      );

      if (dueRules.length === 0) {
        if (!silentIfNone) {
          showToast('All recurring schedules are up to date', { variant: 'info' });
        }
        return 0;
      }

      recurringInFlightRef.current = true;
      try {
        if (isDemoMode) {
          let insertedCount = 0;
          const existingSet = new Set(
            transactionsRef.current
              .filter((t) => t.recurringId)
              .map((t) => `${t.recurringId}_${t.date}`)
          );
          const createdEntries: TransactionRecord[] = [];
          const updatedSchedules = new Map<
            string,
            { nextDueDate: string; lastRunDate: string }
          >();

          for (const rec of dueRules) {
            const { dueDates, nextDueDate } = collectDueOccurrences(
              rec.nextDueDate,
              rec.frequency,
              todayIso,
              rec.startDate
            );
            if (dueDates.length === 0) continue;

            for (const dueDate of dueDates) {
              const dedupe = `${rec.id}_${dueDate}`;
              if (existingSet.has(dedupe)) continue;
              existingSet.add(dedupe);
              createdEntries.push({
                id: `demo_rec_tx_${rec.id}_${dueDate}_${insertedCount}`,
                userId: DEMO_USER_ID,
                title: rec.title,
                amount: rec.amount,
                type: rec.type,
                category: rec.category,
                date: dueDate,
                paymentMethod: rec.paymentMethod,
                notes: rec.notes || `Auto-posted (${rec.frequency} schedule)`,
                recurringId: rec.id,
              });
              insertedCount += 1;
            }
            updatedSchedules.set(rec.id, {
              nextDueDate,
              lastRunDate: dueDates[dueDates.length - 1],
            });
          }

          if (createdEntries.length > 0) {
            setTransactions((prev) =>
              [...createdEntries, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
            );
          }
          if (updatedSchedules.size > 0) {
            setRecurringTransactions((prev) =>
              prev
                .map((r) => {
                  const patch = updatedSchedules.get(r.id);
                  return patch ? { ...r, ...patch } : r;
                })
                .sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : 0))
            );
          }
          if (insertedCount > 0) {
            showToast(
              `${insertedCount} scheduled ${insertedCount === 1 ? 'entry' : 'entries'} posted automatically`,
              { variant: 'success' }
            );
          } else if (!silentIfNone) {
            showToast('All recurring schedules are up to date', { variant: 'info' });
          }
          return insertedCount;
        }

        if (!user || !user.emailVerified) return 0;
        const uid = user.uid;
        let totalInserted = 0;

        for (const rec of dueRules) {
          const recRef = doc(db, 'users', uid, 'recurring_transactions', rec.id);
          const insertedForRule = await runTransaction(db, async (tx) => {
            const snap = await tx.get(recRef);
            if (!snap.exists()) return 0;
            const fresh = snap.data() as Omit<RecurringTransactionRecord, 'id'>;
            if (!fresh.active || fresh.nextDueDate > todayIso) return 0;

            const { dueDates, nextDueDate } = collectDueOccurrences(
              fresh.nextDueDate,
              sanitizeFrequency(fresh.frequency),
              todayIso,
              fresh.startDate
            );
            if (dueDates.length === 0) return 0;

            let posted = 0;
            for (const dueDate of dueDates) {
              const alreadyExists = transactionsRef.current.some(
                (t) => t.recurringId === rec.id && t.date === dueDate
              );
              if (alreadyExists) continue;

              const txRef = doc(collection(db, 'users', uid, 'transactions'));
              const cleanNote = (fresh.notes || `Auto-posted (${fresh.frequency} schedule)`).slice(
                0,
                FIELD_LIMITS.TX_NOTES_MAX
              );
              tx.set(txRef, {
                userId: uid,
                title: fresh.title.slice(0, FIELD_LIMITS.TX_TITLE_MAX),
                amount: clampAmount(fresh.amount),
                type: fresh.type === 'income' ? 'income' : 'expense',
                category: sanitizeCategory(fresh.category),
                date: dueDate,
                paymentMethod: sanitizePaymentMethod(fresh.paymentMethod),
                notes: cleanNote,
                recurringId: rec.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              posted += 1;
            }

            tx.update(recRef, {
              nextDueDate,
              lastRunDate: dueDates[dueDates.length - 1],
              updatedAt: serverTimestamp(),
            });
            return posted;
          });
          totalInserted += insertedForRule;
        }

        if (totalInserted > 0) {
          showToast(
            `${totalInserted} recurring ${totalInserted === 1 ? 'transaction' : 'transactions'} posted automatically`,
            { variant: 'success' }
          );
        } else if (!silentIfNone) {
          showToast('All recurring schedules are up to date', { variant: 'info' });
        }
        return totalInserted;
      } catch (err) {
        if (!silentIfNone) {
          handleFirestoreError(
            err,
            OperationType.WRITE,
            user ? `users/${user.uid}/recurring_transactions` : 'recurring_transactions'
          );
        }
        return 0;
      } finally {
        recurringInFlightRef.current = false;
      }
    },
    [isDemoMode, user, showToast]
  );

  // Background check on initial data load, interval, and tab visibility return
  useEffect(() => {
    if (!txLoaded || !recurringLoaded) return;
    if (!isDemoMode && (!user || !user.emailVerified)) return;

    void processDueRecurringTransactions(true);

    const interval = window.setInterval(() => {
      void processDueRecurringTransactions(true);
    }, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void processDueRecurringTransactions(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [txLoaded, recurringLoaded, isDemoMode, user, recurringTransactions, processDueRecurringTransactions]);

  const addRecurringTransaction = useCallback(
    async (input: RecurringTransactionInput) => {
      const amount = clampAmount(input.amount);
      const title = input.title.trim().slice(0, FIELD_LIMITS.TX_TITLE_MAX);
      if (!title || amount <= 0) {
        throw new Error('Please enter a valid title and positive amount.');
      }
      const frequency = sanitizeFrequency(input.frequency);
      const startDate = sanitizeDateIso(input.startDate);
      const nextDueDate = input.nextDueDate ? sanitizeDateIso(input.nextDueDate) : startDate;
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.TX_NOTES_MAX);

      if (isDemoMode) {
        const record: RecurringTransactionRecord = {
          id: `demo_rec_${Date.now()}`,
          userId: DEMO_USER_ID,
          title,
          amount,
          type: input.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(input.category),
          paymentMethod: sanitizePaymentMethod(input.paymentMethod),
          frequency,
          startDate,
          nextDueDate,
          active: Boolean(input.active),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        };
        setRecurringTransactions((prev) =>
          [...prev, record].sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : 0))
        );
        showToast('Recurring schedule created', { description: title, variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) throw new Error('Verified sign-in required.');
      const path = `users/${user.uid}/recurring_transactions`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'recurring_transactions'), {
          userId: user.uid,
          title,
          amount,
          type: input.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(input.category),
          paymentMethod: sanitizePaymentMethod(input.paymentMethod),
          frequency,
          startDate,
          nextDueDate,
          active: Boolean(input.active),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Recurring schedule saved', { description: title, variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const updateRecurringTransaction = useCallback(
    async (id: string, input: RecurringTransactionInput) => {
      const amount = clampAmount(input.amount);
      const title = input.title.trim().slice(0, FIELD_LIMITS.TX_TITLE_MAX);
      if (!title || amount <= 0) {
        throw new Error('Please enter a valid title and positive amount.');
      }
      const frequency = sanitizeFrequency(input.frequency);
      const startDate = sanitizeDateIso(input.startDate);
      const nextDueDate = input.nextDueDate ? sanitizeDateIso(input.nextDueDate) : startDate;
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.TX_NOTES_MAX) ?? '';

      if (isDemoMode) {
        setRecurringTransactions((prev) =>
          prev
            .map((r) =>
              r.id === id
                ? {
                    ...r,
                    title,
                    amount,
                    type: (input.type === 'income' ? 'income' : 'expense') as TransactionType,
                    category: sanitizeCategory(input.category),
                    paymentMethod: sanitizePaymentMethod(input.paymentMethod),
                    frequency,
                    startDate,
                    nextDueDate,
                    active: Boolean(input.active),
                    notes: cleanNotes,
                  }
                : r
            )
            .sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : 0))
        );
        showToast('Recurring schedule updated', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/recurring_transactions/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'recurring_transactions', id), {
          title,
          amount,
          type: input.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(input.category),
          paymentMethod: sanitizePaymentMethod(input.paymentMethod),
          frequency,
          startDate,
          nextDueDate,
          active: Boolean(input.active),
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        });
        showToast('Recurring schedule updated', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const toggleRecurringTransaction = useCallback(
    async (id: string, active: boolean) => {
      if (isDemoMode) {
        setRecurringTransactions((prev) =>
          prev.map((r) => (r.id === id ? { ...r, active } : r))
        );
        showToast(active ? 'Schedule resumed' : 'Schedule paused', { variant: 'info' });
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/recurring_transactions/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'recurring_transactions', id), {
          active: Boolean(active),
          updatedAt: serverTimestamp(),
        });
        showToast(active ? 'Schedule resumed' : 'Schedule paused', { variant: 'info' });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const deleteRecurringTransaction = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setRecurringTransactions((prev) => prev.filter((r) => r.id !== id));
        showToast('Recurring schedule deleted', { variant: 'info' });
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/recurring_transactions/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'recurring_transactions', id));
        showToast('Recurring schedule deleted', { variant: 'info' });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const triggerRecurringNow = useCallback(
    async (id: string) => {
      const rec = recurringRef.current.find((r) => r.id === id);
      if (!rec) return;
      const todayIso = toIsoDate(new Date());
      const advancedNextDue = computeNextDueDate(
        rec.nextDueDate > todayIso ? rec.nextDueDate : todayIso,
        rec.frequency,
        rec.startDate
      );

      if (isDemoMode) {
        const entry: TransactionRecord = {
          id: `demo_rec_manual_${Date.now()}`,
          userId: DEMO_USER_ID,
          title: rec.title,
          amount: rec.amount,
          type: rec.type,
          category: rec.category,
          date: todayIso,
          paymentMethod: rec.paymentMethod,
          notes: rec.notes || `Posted from recurring rule (${rec.frequency})`,
          recurringId: rec.id,
        };
        setTransactions((prev) =>
          [entry, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        );
        setRecurringTransactions((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, lastRunDate: todayIso, nextDueDate: advancedNextDue } : r
          )
        );
        showToast('Transaction posted now', { description: rec.title, variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const uid = user.uid;
      const path = `users/${uid}/recurring_transactions/${id}`;
      try {
        const batch = writeBatch(db);
        const newTxRef = doc(collection(db, 'users', uid, 'transactions'));
        const recRef = doc(db, 'users', uid, 'recurring_transactions', id);
        batch.set(newTxRef, {
          userId: uid,
          title: rec.title.slice(0, FIELD_LIMITS.TX_TITLE_MAX),
          amount: clampAmount(rec.amount),
          type: rec.type === 'income' ? 'income' : 'expense',
          category: sanitizeCategory(rec.category),
          date: todayIso,
          paymentMethod: sanitizePaymentMethod(rec.paymentMethod),
          notes: (rec.notes || `Posted from recurring rule (${rec.frequency})`).slice(
            0,
            FIELD_LIMITS.TX_NOTES_MAX
          ),
          recurringId: rec.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(recRef, {
          nextDueDate: advancedNextDue,
          lastRunDate: todayIso,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        showToast('Transaction posted now', { description: rec.title, variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const addBudget = useCallback(
    async (input: BudgetInput) => {
      const limit = clampAmount(input.limit);
      if (limit <= 0) throw new Error('Budget limit must be greater than zero.');
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.BUDGET_NOTES_MAX);

      if (isDemoMode) {
        const record: BudgetRecord = {
          id: `demo_b_${Date.now()}`,
          userId: DEMO_USER_ID,
          category: sanitizeBudgetCategory(input.category),
          limit,
          month: sanitizeMonthIso(input.month),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        };
        setBudgets((prev) => [...prev, record]);
        showToast('Budget created', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/budgets`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'budgets'), {
          userId: user.uid,
          category: sanitizeBudgetCategory(input.category),
          limit,
          month: sanitizeMonthIso(input.month),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Budget created', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const updateBudget = useCallback(
    async (id: string, input: BudgetInput) => {
      const limit = clampAmount(input.limit);
      if (limit <= 0) throw new Error('Budget limit must be greater than zero.');
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.BUDGET_NOTES_MAX) ?? '';

      if (isDemoMode) {
        setBudgets((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  category: sanitizeBudgetCategory(input.category),
                  limit,
                  month: sanitizeMonthIso(input.month),
                  notes: cleanNotes,
                }
              : b
          )
        );
        showToast('Budget updated', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/budgets/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'budgets', id), {
          category: sanitizeBudgetCategory(input.category),
          limit,
          month: sanitizeMonthIso(input.month),
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        });
        showToast('Budget updated', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        showToast('Budget removed', { variant: 'info' });
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/budgets/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'budgets', id));
        showToast('Budget removed', { variant: 'info' });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const addGoal = useCallback(
    async (input: GoalInput) => {
      const targetAmount = clampAmount(input.targetAmount);
      const currentAmount = Math.min(Math.max(0, Number(input.currentAmount || 0)), FIELD_LIMITS.AMOUNT_MAX);
      const title = input.title.trim().slice(0, FIELD_LIMITS.GOAL_TITLE_MAX);
      const category = (input.category || 'General').trim().slice(0, FIELD_LIMITS.GOAL_CATEGORY_MAX);
      if (!title || targetAmount <= 0) throw new Error('Valid goal title and target amount required.');
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.GOAL_NOTES_MAX);

      if (isDemoMode) {
        const record: SavingsGoalRecord = {
          id: `demo_g_${Date.now()}`,
          userId: DEMO_USER_ID,
          title,
          targetAmount,
          currentAmount,
          targetDate: sanitizeDateIso(input.targetDate),
          category,
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        };
        setGoals((prev) => [...prev, record]);
        showToast('Savings goal created', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/savings_goals`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'savings_goals'), {
          userId: user.uid,
          title,
          targetAmount,
          currentAmount,
          targetDate: sanitizeDateIso(input.targetDate),
          category,
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Savings goal created', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const updateGoal = useCallback(
    async (id: string, input: GoalInput) => {
      const targetAmount = clampAmount(input.targetAmount);
      const currentAmount = Math.min(Math.max(0, Number(input.currentAmount || 0)), FIELD_LIMITS.AMOUNT_MAX);
      const title = input.title.trim().slice(0, FIELD_LIMITS.GOAL_TITLE_MAX);
      const category = (input.category || 'General').trim().slice(0, FIELD_LIMITS.GOAL_CATEGORY_MAX);
      if (!title || targetAmount <= 0) throw new Error('Valid goal title and target amount required.');
      const cleanNotes = input.notes?.trim().slice(0, FIELD_LIMITS.GOAL_NOTES_MAX) ?? '';

      if (isDemoMode) {
        setGoals((prev) =>
          prev.map((g) =>
            g.id === id
              ? {
                  ...g,
                  title,
                  targetAmount,
                  currentAmount,
                  targetDate: sanitizeDateIso(input.targetDate),
                  category,
                  notes: cleanNotes,
                }
              : g
          )
        );
        showToast('Savings goal updated', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/savings_goals/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'savings_goals', id), {
          title,
          targetAmount,
          currentAmount,
          targetDate: sanitizeDateIso(input.targetDate),
          category,
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        });
        showToast('Savings goal updated', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        setContributions((prev) => prev.filter((c) => c.goalId !== id));
        showToast('Savings goal deleted', { variant: 'info' });
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/savings_goals/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'savings_goals', id));
        showToast('Savings goal deleted', { variant: 'info' });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const addGoalContribution = useCallback(
    async (goalId: string, amountInput: number, date: string, notes?: string) => {
      const amount = clampAmount(amountInput);
      if (amount <= 0) throw new Error('Contribution must be greater than zero.');
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found.');
      const nextAmount = Math.min(goal.currentAmount + amount, FIELD_LIMITS.AMOUNT_MAX);
      const cleanNotes = notes?.trim().slice(0, FIELD_LIMITS.CONTRIBUTION_NOTES_MAX);

      if (isDemoMode) {
        setGoals((prev) =>
          prev.map((g) => (g.id === goalId ? { ...g, currentAmount: nextAmount } : g))
        );
        setContributions((prev) => [
          {
            id: `demo_c_${Date.now()}`,
            userId: DEMO_USER_ID,
            goalId,
            amount,
            date: sanitizeDateIso(date),
            ...(cleanNotes ? { notes: cleanNotes } : {}),
          },
          ...prev,
        ]);
        showToast('Contribution added', { description: goal.title, variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/savings_contributions`;
      try {
        const batch = writeBatch(db);
        const goalRef = doc(db, 'users', user.uid, 'savings_goals', goalId);
        const contribRef = doc(collection(db, 'users', user.uid, 'savings_contributions'));
        batch.update(goalRef, {
          currentAmount: nextAmount,
          updatedAt: serverTimestamp(),
        });
        batch.set(contribRef, {
          userId: user.uid,
          goalId,
          amount,
          date: sanitizeDateIso(date),
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        showToast('Contribution added', { description: goal.title, variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [goals, isDemoMode, user, showToast]
  );

  const addEmiPlan = useCallback(
    async (input: EmiPlanInput) => {
      const title = input.title.trim().slice(0, FIELD_LIMITS.EMI_TITLE_MAX);
      const principal = clampAmount(input.principal);
      const annualRate = Math.min(Math.max(0.1, Number(input.annualRate)), 100);
      const tenureMonths = Math.min(Math.max(1, Math.round(Number(input.tenureMonths))), 600);
      const dueDay = Math.min(Math.max(1, Math.round(Number(input.dueDay))), 28);
      if (!title || principal <= 0) throw new Error('Valid loan title and amount required.');

      if (isDemoMode) {
        setEmiPlans((prev) => [
          ...prev,
          {
            id: `demo_emi_${Date.now()}`,
            userId: DEMO_USER_ID,
            title,
            loanType: input.loanType,
            principal,
            annualRate,
            tenureMonths,
            dueDay,
            reminderEnabled: Boolean(input.reminderEnabled),
          },
        ]);
        showToast('EMI reminder saved', { variant: 'success' });
        return;
      }

      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/emi_plans`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'emi_plans'), {
          userId: user.uid,
          title,
          loanType: input.loanType,
          principal,
          annualRate,
          tenureMonths,
          dueDay,
          reminderEnabled: Boolean(input.reminderEnabled),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('EMI reminder saved', { variant: 'success' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const deleteEmiPlan = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setEmiPlans((prev) => prev.filter((e) => e.id !== id));
        showToast('EMI reminder removed', { variant: 'info' });
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/emi_plans/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'emi_plans', id));
        showToast('EMI reminder removed', { variant: 'info' });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isDemoMode, user, showToast]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/notifications/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', id), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [isDemoMode, user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    if (isDemoMode) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      return;
    }
    if (!user || !user.emailVerified) return;
    const path = `users/${user.uid}/notifications`;
    try {
      const batch = writeBatch(db);
      for (const item of unread) {
        batch.update(doc(db, 'users', user.uid, 'notifications', item.id), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }, [notifications, isDemoMode, user]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        return;
      }
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/notifications/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isDemoMode, user]
  );

  const loadSamplePortfolio = useCallback(async () => {
    if (!user || !user.emailVerified || isDemoMode) return;
    const uid = user.uid;
    const path = `users/${uid}`;
    try {
      const batch = writeBatch(db);
      for (const tx of createDemoTransactions(uid)) {
        const ref = doc(collection(db, 'users', uid, 'transactions'));
        batch.set(ref, {
          userId: uid,
          title: tx.title.slice(0, FIELD_LIMITS.TX_TITLE_MAX),
          amount: clampAmount(tx.amount),
          type: tx.type,
          category: tx.category,
          date: tx.date,
          paymentMethod: tx.paymentMethod,
          ...(tx.notes ? { notes: tx.notes.slice(0, FIELD_LIMITS.TX_NOTES_MAX) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const b of createDemoBudgets(uid)) {
        const ref = doc(collection(db, 'users', uid, 'budgets'));
        batch.set(ref, {
          userId: uid,
          category: b.category,
          limit: clampAmount(b.limit),
          month: b.month,
          ...(b.notes ? { notes: b.notes.slice(0, FIELD_LIMITS.BUDGET_NOTES_MAX) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const g of createDemoGoals(uid)) {
        const ref = doc(collection(db, 'users', uid, 'savings_goals'));
        batch.set(ref, {
          userId: uid,
          title: g.title.slice(0, FIELD_LIMITS.GOAL_TITLE_MAX),
          targetAmount: clampAmount(g.targetAmount),
          currentAmount: g.currentAmount,
          targetDate: g.targetDate,
          category: g.category.slice(0, FIELD_LIMITS.GOAL_CATEGORY_MAX),
          ...(g.notes ? { notes: g.notes.slice(0, FIELD_LIMITS.GOAL_NOTES_MAX) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const rec of createDemoRecurringTransactions(uid)) {
        const ref = doc(collection(db, 'users', uid, 'recurring_transactions'));
        batch.set(ref, {
          userId: uid,
          title: rec.title.slice(0, FIELD_LIMITS.TX_TITLE_MAX),
          amount: clampAmount(rec.amount),
          type: rec.type,
          category: rec.category,
          paymentMethod: rec.paymentMethod,
          frequency: rec.frequency,
          startDate: rec.startDate,
          nextDueDate: rec.nextDueDate,
          ...(rec.lastRunDate ? { lastRunDate: rec.lastRunDate } : {}),
          active: rec.active,
          ...(rec.notes ? { notes: rec.notes.slice(0, FIELD_LIMITS.TX_NOTES_MAX) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, 'users', uid, 'private', 'settings'), {
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast('Starter sample dataset loaded', {
        description: 'You can edit or delete any sample record anytime.',
        variant: 'success',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }, [user, isDemoMode, showToast]);

  const completeOnboarding = useCallback(async () => {
    await updateSettings({ onboardingCompleted: true });
  }, [updateSettings]);

  const deleteAllUserAccountData = useCallback(async () => {
    if (!user || !user.emailVerified || isDemoMode) return;
    const uid = user.uid;
    const subcollections = [
      'transactions',
      'recurring_transactions',
      'budgets',
      'savings_goals',
      'savings_contributions',
      'notifications',
      'emi_plans',
    ];
    try {
      for (const sub of subcollections) {
        const snap = await getDocs(
          query(collection(db, 'users', uid, sub), where('userId', '==', uid))
        );
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', uid, 'private', 'settings'));
      batch.delete(doc(db, 'users', uid));
      await batch.commit();
      await deleteAuthAccount();
      showToast('Account and all personal data deleted', { variant: 'info' });
    } catch (err) {
      if (err instanceof Error && err.message.includes('sign out and sign back in')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  }, [user, isDemoMode, deleteAuthAccount, showToast]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      loading,
      profile,
      settings,
      transactions,
      recurringTransactions,
      budgets,
      goals,
      contributions,
      notifications,
      budgetAlerts,
      emiPlans,
      theme: activeTheme,
      setTheme,
      setCurrency,
      updateSettings,
      updateProfileInfo,
      addTransaction,
      importTransactionsBatch,
      updateTransaction,
      deleteTransaction,
      addRecurringTransaction,
      updateRecurringTransaction,
      toggleRecurringTransaction,
      deleteRecurringTransaction,
      triggerRecurringNow,
      processDueRecurringTransactions,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      addGoalContribution,
      addEmiPlan,
      deleteEmiPlan,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      loadSamplePortfolio,
      completeOnboarding,
      deleteAllUserAccountData,
    }),
    [
      loading,
      profile,
      settings,
      transactions,
      recurringTransactions,
      budgets,
      goals,
      contributions,
      notifications,
      budgetAlerts,
      emiPlans,
      activeTheme,
      setTheme,
      setCurrency,
      updateSettings,
      updateProfileInfo,
      addTransaction,
      importTransactionsBatch,
      updateTransaction,
      deleteTransaction,
      addRecurringTransaction,
      updateRecurringTransaction,
      toggleRecurringTransaction,
      deleteRecurringTransaction,
      triggerRecurringNow,
      processDueRecurringTransactions,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      addGoalContribution,
      addEmiPlan,
      deleteEmiPlan,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      loadSamplePortfolio,
      completeOnboarding,
      deleteAllUserAccountData,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
