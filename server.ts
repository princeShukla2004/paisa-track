import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type Content,
  type LiveServerMessage,
} from '@google/genai';
import {
  requireAuth,
  verifyIdTokenOrThrow,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  appendConversationTurn,
  createUserConversation,
  deleteUserConversation,
  getConversationForUser,
  getConversationMessages,
  getOrCreateUser,
  listUserConversations,
  upsertFinancialSnapshot,
} from './src/db/users.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Simple per-IP sliding window rate limiter for AI endpoints
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= limit) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

const CANONICAL_DEMO_CONTEXT = {
  currency: 'INR',
  currentMonthLabel: 'Current Month (Sample Portfolio)',
  previousMonthLabel: 'Previous Month (Sample Portfolio)',
  totals: {
    totalBalance: 284500,
    monthlyIncome: 145000,
    monthlyExpenses: 62400,
    previousMonthIncome: 140000,
    previousMonthExpenses: 56200,
    totalSavingsInGoals: 345000,
    savingsRatePercent: 56.97,
  },
  currentMonthByCategory: {
    Rent: 24000,
    Food: 12800,
    Shopping: 9400,
    Transport: 4600,
    Bills: 5200,
    Entertainment: 3800,
    Healthcare: 2600,
  },
  previousMonthByCategory: {
    Rent: 24000,
    Food: 10850,
    Shopping: 7200,
    Transport: 4900,
    Bills: 4950,
    Entertainment: 2600,
    Healthcare: 1700,
  },
  budgets: [
    { category: 'Food', limit: 12000, spent: 12800, utilizationPercent: 106.7 },
    { category: 'Shopping', limit: 10000, spent: 9400, utilizationPercent: 94.0 },
    { category: 'Entertainment', limit: 4500, spent: 3800, utilizationPercent: 84.4 },
    { category: 'Transport', limit: 6000, spent: 4600, utilizationPercent: 76.7 },
  ],
  savingsGoals: [
    { title: 'Emergency Fund', currentAmount: 185000, targetAmount: 300000, targetDate: '2027-06-01' },
    { title: 'MacBook Pro Upgrade', currentAmount: 95000, targetAmount: 165000, targetDate: '2027-03-15' },
    { title: 'Japan Autumn Trip', currentAmount: 65000, targetAmount: 180000, targetDate: '2027-10-01' },
  ],
  note: 'This is labeled Sample Demo Portfolio data for preview.',
};

interface FinancialContextPayload {
  currency?: string;
  currentMonthLabel?: string;
  previousMonthLabel?: string;
  transactionCount?: number;
  totals?: Record<string, number | string>;
  currentMonthByCategory?: Record<string, number>;
  previousMonthByCategory?: Record<string, number>;
  budgets?: Array<Record<string, unknown>>;
  savingsGoals?: Array<Record<string, unknown>>;
  recentTransactions?: Array<Record<string, unknown>>;
}

interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

type PersonaKey = 'analyst' | 'budget_coach' | 'loan_planner';
type ModelModeKey = 'balanced' | 'deep' | 'fast';

const PERSONA_PROMPTS: Record<PersonaKey, string> = {
  analyst:
    'Role: Senior Personal Finance Analyst. Focus on cash-flow trends, month-over-month deltas, spending velocity, and category anomalies.',
  budget_coach:
    'Role: Practical Budget & Savings Coach. Focus on trimming discretionary overspend, stabilizing category limits, and accelerating active savings goals.',
  loan_planner:
    'Role: Debt & EMI Strategist. Focus on principal vs. interest tradeoffs, realistic monthly surplus allocation, and emergency fund prioritization.',
};

const MODEL_MODE_CONFIG: Record<
  ModelModeKey,
  { model: string; thinkingLevel?: ThinkingLevel; label: string }
> = {
  balanced: {
    model: 'gemini-4-hydrogen',
    thinkingLevel: ThinkingLevel.MEDIUM,
    label: 'Balanced Analyst (Gemini 4 Hydrogen)',
  },
  deep: {
    model: 'gemini-4-hydrogen',
    thinkingLevel: ThinkingLevel.HIGH,
    label: 'Deep Reasoning (Gemini 4 Hydrogen)',
  },
  fast: {
    model: 'gemini-3.1-flash-lite',
    thinkingLevel: ThinkingLevel.MINIMAL,
    label: 'Quick Answers (Gemini 3.1 Flash Lite)',
  },
};

const ALLOWED_VOICES = new Set(['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir']);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizePersona(raw: unknown): PersonaKey {
  if (raw === 'budget_coach' || raw === 'loan_planner') return raw;
  return 'analyst';
}

function sanitizeModelMode(raw: unknown): ModelModeKey {
  if (raw === 'deep' || raw === 'fast') return raw;
  return 'balanced';
}

function buildSystemInstruction(
  currency: string,
  persona: PersonaKey,
  financialJson: string,
  isVoice = false
): string {
  return [
    'You are PaisaTrack AI Financial Assistant, an intelligent, analytical, and responsible personal finance guide.',
    PERSONA_PROMPTS[persona],
    `The user's display currency is ${currency}. Format monetary amounts clearly using the appropriate currency symbol (INR: ₹, USD: $, EUR: €, GBP: £).`,
    'CRITICAL INTEGRITY RULES:',
    '1. Ground EVERY figure, percentage, category total, budget status, and goal amount strictly in the FINANCIAL_DATA JSON provided below.',
    '2. NEVER invent, fabricate, or hallucinate transactions, merchants, dates, or balances that are not present in FINANCIAL_DATA.',
    '3. If FINANCIAL_DATA shows empty or zero records for a category or month, state clearly that the data is not yet recorded and explain what tracking it will unlock.',
    '4. Clearly distinguish ACTUAL recorded figures (labeled as actual/recorded) from ESTIMATES or hypothetical projections (explicitly labeled as "Estimated" or "Approximate").',
    '5. Never present budgeting or savings suggestions as guaranteed financial returns, and do not provide personalized stock-picking, tax, or legal advice.',
    isVoice
      ? '6. VOICE CONVERSATION STYLE: Respond conversationally in clear, concise spoken sentences (under ~45 seconds per turn unless asked for more detail). Avoid markdown tables, asterisks, or raw JSON readouts; speak numbers naturally.'
      : '6. Keep responses structured, concise, and scannable with clear bullet points and exact numbers.',
    `\nFINANCIAL_DATA (User's actual stored records):\n${financialJson}`,
  ].join('\n');
}

async function createAppServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'paisatrack-api' });
  });

  // Sync summarized portfolio snapshot silently to Cloud SQL for authenticated users
  app.post('/api/finance/sync-snapshot', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@paisatrack.user`;
      const displayName = typeof req.user!.name === 'string' ? req.user!.name : null;

      const userRow = await getOrCreateUser(uid, email, displayName);
      const body = (req.body || {}) as { financialContext?: FinancialContextPayload };
      const ctx = body.financialContext || {};
      const totals = (ctx.totals || {}) as Record<string, unknown>;

      await upsertFinancialSnapshot({
        userId: userRow.id,
        currency: typeof ctx.currency === 'string' ? ctx.currency.slice(0, 8) : 'INR',
        transactionCount: Number(ctx.transactionCount || 0) || 0,
        totalBalance: Number(totals.totalBalance || 0) || 0,
        monthlyIncome: Number(totals.monthlyIncome || 0) || 0,
        monthlyExpenses: Number(totals.monthlyExpenses || 0) || 0,
        summaryJson: JSON.stringify(ctx).slice(0, 24000),
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Snapshot sync error:', err);
      res.status(500).json({ error: 'Unable to sync portfolio snapshot right now.' });
    }
  });

  // List persisted multi-turn conversations for authenticated users
  app.get('/api/ai/conversations', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      await getOrCreateUser(
        uid,
        req.user!.email || `${uid}@paisatrack.user`,
        typeof req.user!.name === 'string' ? req.user!.name : null
      );
      const conversations = await listUserConversations(uid);
      res.json({ conversations });
    } catch (err) {
      console.error('List conversations error:', err);
      res.status(500).json({ error: 'Unable to load conversation threads.' });
    }
  });

  // Fetch messages for a single conversation thread
  app.get('/api/ai/conversations/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const conversationId = Number(req.params.id);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        res.status(400).json({ error: 'Invalid conversation ID.' });
        return;
      }

      const conversation = await getConversationForUser(conversationId, req.user!.uid);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }

      const messages = await getConversationMessages(conversationId, req.user!.uid);
      res.json({ conversation, messages });
    } catch (err) {
      console.error('Get conversation error:', err);
      res.status(500).json({ error: 'Unable to load conversation.' });
    }
  });

  // Delete a conversation thread
  app.delete('/api/ai/conversations/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const conversationId = Number(req.params.id);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        res.status(400).json({ error: 'Invalid conversation ID.' });
        return;
      }

      const deleted = await deleteUserConversation(conversationId, req.user!.uid);
      if (!deleted) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete conversation error:', err);
      res.status(500).json({ error: 'Unable to delete conversation.' });
    }
  });

  // Multi-turn Gemini chat endpoint using ai.chats.create + optional Cloud SQL persistence
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(clientIp)) {
        res.status(429).json({ error: 'Too many AI requests. Please wait a moment and try again.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const body = req.body as {
        message?: unknown;
        mode?: unknown;
        persona?: unknown;
        modelMode?: unknown;
        conversationId?: unknown;
        history?: unknown;
        financialContext?: FinancialContextPayload;
      };

      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 2000) {
        res.status(400).json({ error: 'Please provide a valid question (1–2000 characters).' });
        return;
      }

      const persona = sanitizePersona(body.persona);
      const modelMode = sanitizeModelMode(body.modelMode);
      const selectedModelConfig = MODEL_MODE_CONFIG[modelMode];

      const authHeader = req.headers.authorization;
      const isDemoMode = body.mode === 'demo' && !authHeader;

      let verifiedUser: { id: number; uid: string } | null = null;
      let contextToUse: FinancialContextPayload;
      let activeConversationId: number | null = null;
      let chatHistoryContents: Content[] = [];

      if (isDemoMode) {
        contextToUse = CANONICAL_DEMO_CONTEXT;
        const clientHistory: ChatHistoryTurn[] = Array.isArray(body.history)
          ? body.history
              .filter(
                (item): item is ChatHistoryTurn =>
                  Boolean(item) &&
                  typeof item === 'object' &&
                  ((item as ChatHistoryTurn).role === 'user' ||
                    (item as ChatHistoryTurn).role === 'assistant') &&
                  typeof (item as ChatHistoryTurn).text === 'string'
              )
              .slice(-16)
          : [];
        chatHistoryContents = clientHistory.map((turn) => ({
          role: turn.role === 'user' ? 'user' : 'model',
          parts: [{ text: turn.text.slice(0, 4000) }],
        }));
      } else {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({ error: 'Authentication required to analyze personal financial data.' });
          return;
        }
        const idToken = authHeader.slice('Bearer '.length).trim();
        let decodedUid = '';
        let decodedEmail = '';
        let decodedName: string | null = null;
        try {
          const decoded = await verifyIdTokenOrThrow(idToken);
          decodedUid = decoded.uid;
          decodedEmail = decoded.email || `${decoded.uid}@paisatrack.user`;
          decodedName = typeof decoded.name === 'string' ? decoded.name : null;
        } catch {
          res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
          return;
        }

        contextToUse =
          body.financialContext && typeof body.financialContext === 'object'
            ? body.financialContext
            : {};

        try {
          const dbUser = await getOrCreateUser(decodedUid, decodedEmail, decodedName);
          verifiedUser = { id: dbUser.id, uid: dbUser.uid };

          const requestedConvId = Number(body.conversationId);
          if (Number.isInteger(requestedConvId) && requestedConvId > 0) {
            const existingConv = await getConversationForUser(requestedConvId, dbUser.uid);
            if (existingConv) {
              activeConversationId = existingConv.id;
              const storedMsgs = await getConversationMessages(existingConv.id, dbUser.uid);
              chatHistoryContents = storedMsgs.slice(-24).map((m) => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content.slice(0, 4000) }],
              }));
            }
          }

          if (!activeConversationId) {
            const titleSeed = message.replace(/\s+/g, ' ').slice(0, 56);
            const createdConv = await createUserConversation(
              dbUser.id,
              titleSeed || 'Financial Analysis',
              persona,
              selectedModelConfig.model
            );
            activeConversationId = createdConv.id;
          }
        } catch (dbErr) {
          console.error('Database conversation persistence error (falling back cleanly):', dbErr);
          // Graceful degradation using verified client history if DB is momentarily unavailable
          const fallbackHistory: ChatHistoryTurn[] = Array.isArray(body.history)
            ? body.history
                .filter(
                  (item): item is ChatHistoryTurn =>
                    Boolean(item) &&
                    typeof item === 'object' &&
                    ((item as ChatHistoryTurn).role === 'user' ||
                      (item as ChatHistoryTurn).role === 'assistant') &&
                    typeof (item as ChatHistoryTurn).text === 'string'
                )
                .slice(-16)
            : [];
          chatHistoryContents = fallbackHistory.map((turn) => ({
            role: turn.role === 'user' ? 'user' : 'model',
            parts: [{ text: turn.text.slice(0, 4000) }],
          }));
        }
      }

      const currency = typeof contextToUse.currency === 'string' ? contextToUse.currency : 'INR';
      const sanitizedContext = JSON.stringify(contextToUse).slice(0, 24000);
      const systemInstruction = buildSystemInstruction(currency, persona, sanitizedContext, false);

      const chat = ai.chats.create({
        model: selectedModelConfig.model,
        history: chatHistoryContents,
        config: {
          systemInstruction,
          ...(selectedModelConfig.thinkingLevel
            ? {
                thinkingConfig: {
                  thinkingLevel: selectedModelConfig.thinkingLevel,
                },
              }
            : {}),
        },
      });

      const response = await chat.sendMessage({ message });
      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'The AI model returned an empty response. Please try again.' });
        return;
      }

      if (verifiedUser && activeConversationId) {
        try {
          await appendConversationTurn({
            conversationId: activeConversationId,
            userId: verifiedUser.id,
            userText: message,
            assistantText: reply,
            model: selectedModelConfig.model,
            persona,
          });
        } catch (persistErr) {
          console.error('Unable to persist chat turn:', persistErr);
        }
      }

      res.json({
        reply,
        model: selectedModelConfig.model,
        modelLabel: selectedModelConfig.label,
        persona,
        conversationId: activeConversationId,
        isDemoData: isDemoMode,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected server error';
      console.error('AI Chat Error:', msg);
      if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
        res.status(403).json({
          error: 'Gemini API access was denied. Please check your GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error: 'AI quota limit reached. Please try again in a moment.',
        });
        return;
      }
      res.status(500).json({ error: 'Unable to generate AI insight right now. Please try again.' });
    }
  });

  const httpServer = http.createServer(app);

  // Real-Time Gemini Live API WebSocket bridge (/api/live)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '/', 'http://localhost');
      if (parsedUrl.pathname !== '/api/live') {
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs: WebSocket, request: http.IncomingMessage) => {
    const clientIp =
      (typeof request.headers['x-forwarded-for'] === 'string'
        ? request.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      request.socket.remoteAddress ||
      'unknown';

    if (!checkRateLimit(clientIp, 12, 60_000)) {
      clientWs.send(JSON.stringify({ error: 'Too many voice session attempts. Please wait a moment.' }));
      clientWs.close();
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
        })
      );
      clientWs.close();
      return;
    }

    const parsedUrl = new URL(request.url || '/', 'http://localhost');
    const isDemoMode = parsedUrl.searchParams.get('mode') === 'demo';
    const token = parsedUrl.searchParams.get('token') || '';

    if (!isDemoMode) {
      if (!token) {
        clientWs.send(JSON.stringify({ error: 'Authentication required for live voice sessions.' }));
        clientWs.close();
        return;
      }
      try {
        await verifyIdTokenOrThrow(token);
      } catch {
        clientWs.send(JSON.stringify({ error: 'Invalid or expired session token. Please sign in again.' }));
        clientWs.close();
        return;
      }
    }

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let isClosing = false;

    const cleanup = () => {
      if (isClosing) return;
      isClosing = true;
      try {
        liveSession?.close();
      } catch {
        // ignore close errors
      }
      liveSession = null;
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    clientWs.on('message', async (rawData) => {
      if (isClosing) return;
      let payload: {
        type?: string;
        voice?: string;
        persona?: string;
        financialContext?: FinancialContextPayload;
        audio?: string;
        text?: string;
      };
      try {
        payload = JSON.parse(rawData.toString()) as typeof payload;
      } catch {
        return;
      }

      if (payload.type === 'init' && !liveSession) {
        const voiceName = ALLOWED_VOICES.has(payload.voice || '') ? payload.voice! : 'Zephyr';
        const persona = sanitizePersona(payload.persona);
        const contextToUse = isDemoMode
          ? CANONICAL_DEMO_CONTEXT
          : payload.financialContext && typeof payload.financialContext === 'object'
          ? payload.financialContext
          : {};
        const currency = typeof contextToUse.currency === 'string' ? contextToUse.currency : 'INR';
        const contextJson = JSON.stringify(contextToUse).slice(0, 20000);
        const systemInstruction = buildSystemInstruction(currency, persona, contextJson, true);

        try {
          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction,
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                if (clientWs.readyState !== WebSocket.OPEN) return;
                const content = message.serverContent;
                if (content?.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ inputTranscript: content.inputTranscription.text })
                  );
                }
                if (content?.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ outputTranscript: content.outputTranscription.text })
                  );
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                  }
                }
                if (content?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
                if (content?.turnComplete) {
                  clientWs.send(JSON.stringify({ turnComplete: true }));
                }
              },
              onerror: (err: unknown) => {
                console.error('Gemini Live session error:', err);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      error: 'Voice session encountered a connection error. Please reconnect.',
                    })
                  );
                }
              },
              onclose: () => {
                if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
                  clientWs.send(JSON.stringify({ closed: true }));
                  clientWs.close();
                }
              },
            },
          });

          if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
            clientWs.send(JSON.stringify({ ready: true, voice: voiceName }));
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unable to start live voice session.';
          console.error('Gemini Live connect error:', msg);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: msg }));
            clientWs.close();
          }
        }
        return;
      }

      if (!liveSession) return;

      if (typeof payload.audio === 'string' && payload.audio.length > 0) {
        liveSession.sendRealtimeInput({
          audio: {
            data: payload.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (typeof payload.text === 'string' && payload.text.trim().length > 0) {
        liveSession.sendRealtimeInput({
          text: payload.text.trim().slice(0, 1000),
        });
      }
    });
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PaisaTrack server listening on http://0.0.0.0:${PORT}`);
  });
}

createAppServer().catch((err) => {
  console.error('Failed to start PaisaTrack server:', err);
  process.exit(1);
});
