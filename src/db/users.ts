import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  aiConversations,
  aiMessages,
  financialLedgerSnapshots,
  users,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const safeEmail = (email || `${uid}@paisatrack.user`).slice(0, 160);
    const safeName = displayName ? displayName.slice(0, 80) : null;
    const result = await db
      .insert(users)
      .values({
        uid,
        email: safeEmail,
        displayName: safeName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: safeEmail,
          ...(safeName ? { displayName: safeName } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Unable to access user workspace right now.', { cause: error });
  }
}

export async function listUserConversations(uid: string) {
  try {
    const rows = await db
      .select({
        id: aiConversations.id,
        title: aiConversations.title,
        persona: aiConversations.persona,
        model: aiConversations.model,
        createdAt: aiConversations.createdAt,
        updatedAt: aiConversations.updatedAt,
      })
      .from(aiConversations)
      .innerJoin(users, eq(aiConversations.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(25);

    return rows;
  } catch (error) {
    console.error('Database query failed in listUserConversations:', error);
    throw new Error('Unable to load conversation history.', { cause: error });
  }
}

export async function createUserConversation(
  userId: number,
  title: string,
  persona: string,
  model: string
) {
  try {
    const inserted = await db
      .insert(aiConversations)
      .values({
        userId,
        title: title.slice(0, 120),
        persona: persona.slice(0, 40),
        model: model.slice(0, 60),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createUserConversation:', error);
    throw new Error('Unable to create conversation thread.', { cause: error });
  }
}

export async function getConversationForUser(conversationId: number, uid: string) {
  try {
    const rows = await db
      .select({
        id: aiConversations.id,
        userId: aiConversations.userId,
        title: aiConversations.title,
        persona: aiConversations.persona,
        model: aiConversations.model,
        updatedAt: aiConversations.updatedAt,
      })
      .from(aiConversations)
      .innerJoin(users, eq(aiConversations.userId, users.id))
      .where(and(eq(aiConversations.id, conversationId), eq(users.uid, uid)))
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getConversationForUser:', error);
    throw new Error('Unable to load conversation.', { cause: error });
  }
}

export async function getConversationMessages(conversationId: number, uid: string) {
  try {
    const rows = await db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
        model: aiMessages.model,
        createdAt: aiMessages.createdAt,
      })
      .from(aiMessages)
      .innerJoin(users, eq(aiMessages.userId, users.id))
      .where(and(eq(aiMessages.conversationId, conversationId), eq(users.uid, uid)))
      .orderBy(asc(aiMessages.id))
      .limit(100);

    return rows;
  } catch (error) {
    console.error('Database query failed in getConversationMessages:', error);
    throw new Error('Unable to load conversation messages.', { cause: error });
  }
}

export async function appendConversationTurn(params: {
  conversationId: number;
  userId: number;
  userText: string;
  assistantText: string;
  model: string;
  persona: string;
}) {
  try {
    await db.insert(aiMessages).values([
      {
        conversationId: params.conversationId,
        userId: params.userId,
        role: 'user',
        content: params.userText,
        model: null,
      },
      {
        conversationId: params.conversationId,
        userId: params.userId,
        role: 'assistant',
        content: params.assistantText,
        model: params.model,
      },
    ]);

    await db
      .update(aiConversations)
      .set({
        model: params.model,
        persona: params.persona,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiConversations.id, params.conversationId),
          eq(aiConversations.userId, params.userId)
        )
      );
  } catch (error) {
    console.error('Database query failed in appendConversationTurn:', error);
    throw new Error('Unable to save conversation message.', { cause: error });
  }
}

export async function deleteUserConversation(conversationId: number, uid: string) {
  try {
    const existing = await getConversationForUser(conversationId, uid);
    if (!existing) return false;
    await db
      .delete(aiConversations)
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.userId, existing.userId)
        )
      );
    return true;
  } catch (error) {
    console.error('Database query failed in deleteUserConversation:', error);
    throw new Error('Unable to delete conversation.', { cause: error });
  }
}

export async function upsertFinancialSnapshot(params: {
  userId: number;
  currency: string;
  transactionCount: number;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  summaryJson: string;
}) {
  try {
    await db
      .insert(financialLedgerSnapshots)
      .values({
        userId: params.userId,
        currency: params.currency,
        transactionCount: params.transactionCount,
        totalBalance: params.totalBalance,
        monthlyIncome: params.monthlyIncome,
        monthlyExpenses: params.monthlyExpenses,
        summaryJson: params.summaryJson,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: financialLedgerSnapshots.userId,
        set: {
          currency: params.currency,
          transactionCount: params.transactionCount,
          totalBalance: params.totalBalance,
          monthlyIncome: params.monthlyIncome,
          monthlyExpenses: params.monthlyExpenses,
          summaryJson: params.summaryJson,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Database query failed in upsertFinancialSnapshot:', error);
    throw new Error('Unable to sync financial snapshot.', { cause: error });
  }
}
