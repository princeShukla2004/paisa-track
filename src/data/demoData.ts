import type {
  BudgetRecord,
  EmiPlanRecord,
  NotificationRecord,
  RecurringTransactionRecord,
  SavingsContributionRecord,
  SavingsGoalRecord,
  TransactionRecord,
  UserProfile,
  UserSettings,
} from '../types/finance';

function offsetIsoDate(monthsAgo: number, dayOfMonth: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), maxDay);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(safeDay).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function offsetMonthKey(monthsAgo: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

function futureIsoDate(monthsAhead: number, dayOfMonth = 15): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthsAhead, dayOfMonth);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEMO_USER_ID = 'demo_portfolio_user';

export const DEMO_PROFILE: UserProfile = {
  uid: DEMO_USER_ID,
  displayName: 'Prince Kumar',
};

export const DEMO_SETTINGS: UserSettings = {
  userId: DEMO_USER_ID,
  email: 'demo.preview@paisatrack.app',
  phone: '+91 98200 00000',
  currency: 'INR',
  dateFormat: 'DD MMM YYYY',
  theme: 'dark',
  notificationsEnabled: true,
  budgetAlertsEnabled: true,
  goalRemindersEnabled: true,
  unusualSpendingEnabled: true,
  monthlySummaryEnabled: true,
  emiRemindersEnabled: true,
  onboardingCompleted: true,
};

export function createDemoTransactions(userId: string = DEMO_USER_ID): TransactionRecord[] {
  const todayDay = Math.min(new Date().getDate(), 25);
  return [
    // Current month (0 months ago)
    {
      id: 'demo_tx_1',
      userId,
      title: 'Monthly Tech Salary',
      amount: 120000,
      type: 'income',
      category: 'Salary',
      date: offsetIsoDate(0, 1),
      paymentMethod: 'Bank Transfer',
      notes: 'Primary software engineering payroll',
    },
    {
      id: 'demo_tx_2',
      userId,
      title: 'UI Architecture Advisory',
      amount: 25000,
      type: 'income',
      category: 'Freelance',
      date: offsetIsoDate(0, Math.min(todayDay, 9)),
      paymentMethod: 'Bank Transfer',
      notes: 'Design system retainer',
    },
    {
      id: 'demo_tx_3',
      userId,
      title: 'Apartment Monthly Rent',
      amount: 24000,
      type: 'expense',
      category: 'Rent',
      date: offsetIsoDate(0, 3),
      paymentMethod: 'Bank Transfer',
      notes: 'Indiranagar 2BHK',
    },
    {
      id: 'demo_tx_4',
      userId,
      title: 'Whole Foods & Organic Groceries',
      amount: 6450,
      type: 'expense',
      category: 'Food',
      date: offsetIsoDate(0, Math.min(todayDay, 6)),
      paymentMethod: 'UPI',
      notes: 'Weekly kitchen restock',
    },
    {
      id: 'demo_tx_5',
      userId,
      title: 'Dining & Specialty Coffee',
      amount: 6350,
      type: 'expense',
      category: 'Food',
      date: offsetIsoDate(0, Math.max(1, todayDay - 2)),
      paymentMethod: 'Card',
      notes: 'Team dinner + weekend brunch',
    },
    {
      id: 'demo_tx_6',
      userId,
      title: 'Ergonomic Desk Lamp & Apparel',
      amount: 9400,
      type: 'expense',
      category: 'Shopping',
      date: offsetIsoDate(0, Math.max(1, todayDay - 3)),
      paymentMethod: 'Card',
      notes: 'Workspace upgrade',
    },
    {
      id: 'demo_tx_7',
      userId,
      title: 'Fiber Internet & Electricity',
      amount: 5200,
      type: 'expense',
      category: 'Bills',
      date: offsetIsoDate(0, Math.min(todayDay, 11)),
      paymentMethod: 'UPI',
      notes: 'Monthly utilities autopay',
    },
    {
      id: 'demo_tx_8',
      userId,
      title: 'Metro Pass & Cab Commutes',
      amount: 4600,
      type: 'expense',
      category: 'Transport',
      date: offsetIsoDate(0, Math.max(1, todayDay - 1)),
      paymentMethod: 'Wallet',
      notes: 'Airport + daily metro',
    },
    {
      id: 'demo_tx_9',
      userId,
      title: 'IMAX Tickets & Streaming Bundle',
      amount: 3800,
      type: 'expense',
      category: 'Entertainment',
      date: offsetIsoDate(0, todayDay),
      paymentMethod: 'UPI',
      notes: 'Weekend cinema & music plan',
    },
    {
      id: 'demo_tx_10',
      userId,
      title: 'Annual Dental & Lab Checkup',
      amount: 2600,
      type: 'expense',
      category: 'Healthcare',
      date: offsetIsoDate(0, Math.min(todayDay, 14)),
      paymentMethod: 'Card',
      notes: 'Preventive wellness',
    },

    // Last month (1 month ago)
    {
      id: 'demo_tx_11',
      userId,
      title: 'Monthly Tech Salary',
      amount: 120000,
      type: 'income',
      category: 'Salary',
      date: offsetIsoDate(1, 1),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_12',
      userId,
      title: 'Product Audit Consulting',
      amount: 20000,
      type: 'income',
      category: 'Freelance',
      date: offsetIsoDate(1, 16),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_13',
      userId,
      title: 'Apartment Monthly Rent',
      amount: 24000,
      type: 'expense',
      category: 'Rent',
      date: offsetIsoDate(1, 3),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_14',
      userId,
      title: 'Groceries & Dining Out',
      amount: 10850,
      type: 'expense',
      category: 'Food',
      date: offsetIsoDate(1, 12),
      paymentMethod: 'UPI',
    },
    {
      id: 'demo_tx_15',
      userId,
      title: 'Running Shoes & Accessories',
      amount: 7200,
      type: 'expense',
      category: 'Shopping',
      date: offsetIsoDate(1, 18),
      paymentMethod: 'Card',
    },
    {
      id: 'demo_tx_16',
      userId,
      title: 'Electricity, Water & Mobile',
      amount: 4950,
      type: 'expense',
      category: 'Bills',
      date: offsetIsoDate(1, 10),
      paymentMethod: 'UPI',
    },
    {
      id: 'demo_tx_17',
      userId,
      title: 'Cab Rides & Fuel',
      amount: 4900,
      type: 'expense',
      category: 'Transport',
      date: offsetIsoDate(1, 20),
      paymentMethod: 'Wallet',
    },
    {
      id: 'demo_tx_18',
      userId,
      title: 'Concert & Subscriptions',
      amount: 2600,
      type: 'expense',
      category: 'Entertainment',
      date: offsetIsoDate(1, 22),
      paymentMethod: 'Card',
    },
    {
      id: 'demo_tx_19',
      userId,
      title: 'Pharmacy & Vitamins',
      amount: 1700,
      type: 'expense',
      category: 'Healthcare',
      date: offsetIsoDate(1, 15),
      paymentMethod: 'UPI',
    },

    // 2 months ago
    {
      id: 'demo_tx_20',
      userId,
      title: 'Monthly Tech Salary',
      amount: 120000,
      type: 'income',
      category: 'Salary',
      date: offsetIsoDate(2, 1),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_21',
      userId,
      title: 'Index Dividend Payout',
      amount: 8500,
      type: 'income',
      category: 'Investments',
      date: offsetIsoDate(2, 19),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_22',
      userId,
      title: 'Apartment Monthly Rent',
      amount: 24000,
      type: 'expense',
      category: 'Rent',
      date: offsetIsoDate(2, 3),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_23',
      userId,
      title: 'Groceries & Cafes',
      amount: 10200,
      type: 'expense',
      category: 'Food',
      date: offsetIsoDate(2, 14),
      paymentMethod: 'UPI',
    },
    {
      id: 'demo_tx_24',
      userId,
      title: 'Online Course Subscription',
      amount: 4500,
      type: 'expense',
      category: 'Education',
      date: offsetIsoDate(2, 9),
      paymentMethod: 'Card',
    },
    {
      id: 'demo_tx_25',
      userId,
      title: 'Utilities & Broadband',
      amount: 4800,
      type: 'expense',
      category: 'Bills',
      date: offsetIsoDate(2, 11),
      paymentMethod: 'UPI',
    },

    // 3 months ago
    {
      id: 'demo_tx_26',
      userId,
      title: 'Monthly Tech Salary',
      amount: 115000,
      type: 'income',
      category: 'Salary',
      date: offsetIsoDate(3, 1),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_27',
      userId,
      title: 'Apartment Monthly Rent',
      amount: 24000,
      type: 'expense',
      category: 'Rent',
      date: offsetIsoDate(3, 3),
      paymentMethod: 'Bank Transfer',
    },
    {
      id: 'demo_tx_28',
      userId,
      title: 'Food & Dining',
      amount: 9600,
      type: 'expense',
      category: 'Food',
      date: offsetIsoDate(3, 18),
      paymentMethod: 'UPI',
    },
    {
      id: 'demo_tx_29',
      userId,
      title: 'Shopping & Wardrobe',
      amount: 8100,
      type: 'expense',
      category: 'Shopping',
      date: offsetIsoDate(3, 21),
      paymentMethod: 'Card',
    },
  ];
}

export function createDemoBudgets(userId: string = DEMO_USER_ID): BudgetRecord[] {
  const currentMonth = offsetMonthKey(0);
  return [
    {
      id: 'demo_b_1',
      userId,
      category: 'Food',
      limit: 12000,
      month: currentMonth,
      notes: 'Groceries + dining out cap',
    },
    {
      id: 'demo_b_2',
      userId,
      category: 'Shopping',
      limit: 10000,
      month: currentMonth,
      notes: 'Discretionary purchases',
    },
    {
      id: 'demo_b_3',
      userId,
      category: 'Transport',
      limit: 6000,
      month: currentMonth,
      notes: 'Commute & travel',
    },
    {
      id: 'demo_b_4',
      userId,
      category: 'Entertainment',
      limit: 4500,
      month: currentMonth,
      notes: 'Movies, events & subscriptions',
    },
    {
      id: 'demo_b_5',
      userId,
      category: 'Bills',
      limit: 6500,
      month: currentMonth,
      notes: 'Electricity, fiber & mobile',
    },
  ];
}

export function createDemoGoals(userId: string = DEMO_USER_ID): SavingsGoalRecord[] {
  return [
    {
      id: 'demo_g_1',
      userId,
      title: 'Emergency Fund (6 Months)',
      targetAmount: 300000,
      currentAmount: 185000,
      targetDate: futureIsoDate(8, 1),
      category: 'Emergency Fund',
      notes: 'Liquid high-yield reserve',
    },
    {
      id: 'demo_g_2',
      userId,
      title: 'MacBook Pro Workstation',
      targetAmount: 165000,
      currentAmount: 95000,
      targetDate: futureIsoDate(5, 15),
      category: 'Tech Upgrade',
      notes: 'For independent consulting work',
    },
    {
      id: 'demo_g_3',
      userId,
      title: 'Japan Autumn Vacation',
      targetAmount: 180000,
      currentAmount: 65000,
      targetDate: futureIsoDate(11, 10),
      category: 'Vacation',
      notes: 'Tokyo + Kyoto 10-day itinerary',
    },
  ];
}

export function createDemoContributions(userId: string = DEMO_USER_ID): SavingsContributionRecord[] {
  return [
    {
      id: 'demo_c_1',
      userId,
      goalId: 'demo_g_1',
      amount: 25000,
      date: offsetIsoDate(0, 5),
      notes: 'Monthly automated reserve',
    },
    {
      id: 'demo_c_2',
      userId,
      goalId: 'demo_g_2',
      amount: 15000,
      date: offsetIsoDate(0, 8),
      notes: 'Freelance retainer allocation',
    },
    {
      id: 'demo_c_3',
      userId,
      goalId: 'demo_g_3',
      amount: 10000,
      date: offsetIsoDate(1, 14),
      notes: 'Travel fund deposit',
    },
  ];
}

export function createDemoEmiPlans(userId: string = DEMO_USER_ID): EmiPlanRecord[] {
  return [
    {
      id: 'demo_e_1',
      userId,
      title: 'EV Compact SUV Loan',
      loanType: 'Car Loan',
      principal: 950000,
      annualRate: 8.9,
      tenureMonths: 60,
      dueDay: 5,
      reminderEnabled: true,
    },
  ];
}

export function createDemoNotifications(userId: string = DEMO_USER_ID): NotificationRecord[] {
  return [
    {
      id: 'demo_n_1',
      userId,
      title: 'Food Budget Exceeded (107%)',
      message: 'You have spent ₹12,800 against your ₹12,000 Food budget this month.',
      type: 'budget',
      read: false,
      dedupeKey: 'demo_budget_food',
    },
    {
      id: 'demo_n_2',
      userId,
      title: 'Shopping Budget at 94%',
      message: 'You have ₹600 remaining in your Shopping budget for this month.',
      type: 'budget',
      read: false,
      dedupeKey: 'demo_budget_shopping',
    },
    {
      id: 'demo_n_3',
      userId,
      title: 'Unusual Entertainment Spend',
      message: 'Entertainment spending increased by 46% compared to last month.',
      type: 'unusual',
      read: true,
      dedupeKey: 'demo_unusual_ent',
    },
  ];
}

export function createDemoRecurringTransactions(
  userId: string = DEMO_USER_ID
): RecurringTransactionRecord[] {
  return [
    {
      id: 'demo_rec_1',
      userId,
      title: 'Monthly Tech Salary',
      amount: 120000,
      type: 'income',
      category: 'Salary',
      paymentMethod: 'Bank Transfer',
      frequency: 'monthly',
      startDate: offsetIsoDate(3, 1),
      nextDueDate: futureIsoDate(1, 1),
      lastRunDate: offsetIsoDate(0, 1),
      active: true,
      notes: 'Primary software engineering payroll',
    },
    {
      id: 'demo_rec_2',
      userId,
      title: 'Apartment Monthly Rent',
      amount: 24000,
      type: 'expense',
      category: 'Rent',
      paymentMethod: 'Bank Transfer',
      frequency: 'monthly',
      startDate: offsetIsoDate(3, 3),
      nextDueDate: futureIsoDate(1, 3),
      lastRunDate: offsetIsoDate(0, 3),
      active: true,
      notes: 'Indiranagar 2BHK standing order',
    },
    {
      id: 'demo_rec_3',
      userId,
      title: 'Fiber Internet & Streaming Bundle',
      amount: 2499,
      type: 'expense',
      category: 'Bills',
      paymentMethod: 'UPI',
      frequency: 'monthly',
      startDate: offsetIsoDate(2, 11),
      nextDueDate: futureIsoDate(1, 11),
      lastRunDate: offsetIsoDate(0, 11),
      active: true,
      notes: 'Gigabit fiber + cloud storage',
    },
    {
      id: 'demo_rec_4',
      userId,
      title: 'Annual Domain & Cloud Backup',
      amount: 4200,
      type: 'expense',
      category: 'Bills',
      paymentMethod: 'Card',
      frequency: 'yearly',
      startDate: offsetIsoDate(6, 15),
      nextDueDate: futureIsoDate(6, 15),
      lastRunDate: offsetIsoDate(6, 15),
      active: false,
      notes: 'Paused until renewal review',
    },
  ];
}
