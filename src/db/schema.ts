import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  currency: text('currency').notNull().default('INR'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  persona: text('persona').notNull().default('analyst'),
  model: text('model').notNull().default('gemini-4-hydrogen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => aiConversations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  model: text('model'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialLedgerSnapshots = pgTable('financial_ledger_snapshots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  currency: text('currency').notNull().default('INR'),
  transactionCount: integer('transaction_count').notNull().default(0),
  totalBalance: doublePrecision('total_balance').notNull().default(0),
  monthlyIncome: doublePrecision('monthly_income').notNull().default(0),
  monthlyExpenses: doublePrecision('monthly_expenses').notNull().default(0),
  summaryJson: text('summary_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(aiConversations),
  messages: many(aiMessages),
  snapshot: one(financialLedgerSnapshots, {
    fields: [users.id],
    references: [financialLedgerSnapshots.userId],
  }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
  user: one(users, {
    fields: [aiMessages.userId],
    references: [users.id],
  }),
}));

export const financialLedgerSnapshotsRelations = relations(
  financialLedgerSnapshots,
  ({ one }) => ({
    user: one(users, {
      fields: [financialLedgerSnapshots.userId],
      references: [users.id],
    }),
  })
);
