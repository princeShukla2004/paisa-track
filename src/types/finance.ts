export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';
export type DateFormatOption = 'DD MMM YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type ThemeMode = 'dark' | 'light';
export type TransactionType = 'income' | 'expense';

export const TRANSACTION_CATEGORIES = [
  'Food',
  'Shopping',
  'Transport',
  'Rent',
  'Bills',
  'Healthcare',
  'Education',
  'Entertainment',
  'Salary',
  'Freelance',
  'Investments',
  'Other',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const BUDGET_CATEGORIES = [
  'Food',
  'Shopping',
  'Transport',
  'Rent',
  'Bills',
  'Healthcare',
  'Education',
  'Entertainment',
  'Other',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  'UPI',
  'Card',
  'Bank Transfer',
  'Cash',
  'Wallet',
  'Other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type LoanType = 'Home Loan' | 'Personal Loan' | 'Car Loan' | 'Education Loan';

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export type NotificationType = 'budget' | 'goal' | 'unusual' | 'summary' | 'emi';

export type DashboardSection =
  | 'overview'
  | 'transactions'
  | 'recurring'
  | 'budgets'
  | 'analytics'
  | 'goals'
  | 'emi'
  | 'assistant'
  | 'nearby'
  | 'settings';

export type DateFilterPreset =
  | 'today'
  | 'week'
  | 'month'
  | 'last_month'
  | 'year'
  | 'custom';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserSettings {
  userId: string;
  email: string;
  phone?: string;
  currency: CurrencyCode;
  dateFormat: DateFormatOption;
  theme: ThemeMode;
  notificationsEnabled: boolean;
  budgetAlertsEnabled: boolean;
  goalRemindersEnabled: boolean;
  unusualSpendingEnabled: boolean;
  monthlySummaryEnabled: boolean;
  emiRemindersEnabled: boolean;
  onboardingCompleted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  notes?: string;
  recurringId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecurringTransactionRecord {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  startDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  lastRunDate?: string; // YYYY-MM-DD
  active: boolean;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BudgetRecord {
  id: string;
  userId: string;
  category: BudgetCategory;
  limit: number;
  month: string; // YYYY-MM
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavingsGoalRecord {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  category: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavingsContributionRecord {
  id: string;
  userId: string;
  goalId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt?: unknown;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  dedupeKey?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmiPlanRecord {
  id: string;
  userId: string;
  title: string;
  loanType: LoanType;
  principal: number;
  annualRate: number;
  tenureMonths: number;
  dueDay: number;
  reminderEnabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Validation limits synced verbatim with firebase-blueprint.json
export const FIELD_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  PHOTO_URL_MAX: 500,
  EMAIL_MAX: 160,
  PHONE_MAX: 32,
  TX_TITLE_MAX: 120,
  TX_NOTES_MAX: 500,
  BUDGET_NOTES_MAX: 300,
  GOAL_TITLE_MAX: 100,
  GOAL_CATEGORY_MAX: 40,
  GOAL_NOTES_MAX: 400,
  CONTRIBUTION_NOTES_MAX: 300,
  EMI_TITLE_MAX: 100,
  AMOUNT_MAX: 1_000_000_000,
} as const;

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; label: string; locale: string; name: string }
> = {
  INR: { symbol: '₹', label: 'INR (₹)', locale: 'en-IN', name: 'Indian Rupee' },
  USD: { symbol: '$', label: 'USD ($)', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '€', label: 'EUR (€)', locale: 'de-DE', name: 'Euro' },
  GBP: { symbol: '£', label: 'GBP (£)', locale: 'en-GB', name: 'British Pound' },
};

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  Food: '#F59E0B',
  Shopping: '#8B5CF6',
  Transport: '#06B6D4',
  Rent: '#EC4899',
  Bills: '#3B82F6',
  Healthcare: '#EF4444',
  Education: '#14B8A6',
  Entertainment: '#A855F7',
  Salary: '#10B981',
  Freelance: '#22D3EE',
  Investments: '#6366F1',
  Other: '#64748B',
};
