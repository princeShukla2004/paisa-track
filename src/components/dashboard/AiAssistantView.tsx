import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Bot,
  FileText,
  History,
  MessageSquarePlus,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  Trash2,
  User as UserIcon,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { getMonthLabel } from '../../lib/formatters';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  modelLabel?: string;
  isError?: boolean;
}

interface ConversationSummary {
  id: number;
  title: string;
  persona: string;
  model: string;
  updatedAt: string;
}

interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
}

type AssistantTab = 'chat' | 'voice';
type PersonaKey = 'analyst' | 'budget_coach' | 'loan_planner';
type ModelModeKey = 'balanced' | 'deep' | 'fast';
type VoiceName = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';

const PERSONAS: Array<{ id: PersonaKey; label: string; subtitle: string }> = [
  { id: 'analyst', label: 'Financial Analyst', subtitle: 'Cashflow & spending deltas' },
  { id: 'budget_coach', label: 'Budget Coach', subtitle: 'Limits & savings habits' },
  { id: 'loan_planner', label: 'EMI Strategist', subtitle: 'Debt & prepayment plans' },
];

const MODEL_MODES: Array<{ id: ModelModeKey; label: string; hint: string }> = [
  { id: 'balanced', label: 'Balanced · Gemini 4 Hydrogen', hint: 'Standard reasoning & insight' },
  { id: 'deep', label: 'Deep Reasoning · Gemini 4 Hydrogen', hint: 'Multi-step portfolio analysis' },
  { id: 'fast', label: 'Quick · Gemini 3.1 Flash Lite', hint: 'Lowest latency answers' },
];

const VOICE_OPTIONS: VoiceName[] = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir'];

const SUGGESTED_QUESTIONS = [
  'Compare my spending this month vs last month by category.',
  'Identify potential non-essential expenses where I could save more.',
  'Review my current budget utilization and highlight any risks.',
  'How am I pacing toward my active savings goals?',
];

function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const float32 = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < float32.length; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export function AiAssistantView() {
  const { user, isDemoMode } = useAuth();
  const { profile, transactions, budgets, goals, settings } = useFinance();

  const [activeTab, setActiveTab] = useState<AssistantTab>('chat');
  const [persona, setPersona] = useState<PersonaKey>('analyst');
  const [modelMode, setModelMode] = useState<ModelModeKey>('balanced');

  const welcomeMessage: ChatMessage = useMemo(
    () => ({
      id: 'welcome',
      role: 'assistant',
      text: isDemoMode
        ? `Hello ${profile?.displayName || 'Prince Kumar'}! I am your PaisaTrack AI Financial Assistant analyzing your demo portfolio. Choose an advisor role, switch reasoning modes, or start a live voice conversation anytime.`
        : 'Hello! I am your PaisaTrack AI Financial Assistant. Every insight I provide is grounded strictly in your stored transactions, budgets, and savings goals.',
    }),
    [isDemoMode, profile?.displayName]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live Voice state & refs (refs prevent stale closures inside onaudioprocess)
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Zephyr');
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const voiceTranscriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mutedRef.current = micMuted;
  }, [micMuted]);

  const financialContext = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, '0')}`;

    let totalIncome = 0;
    let totalExpenses = 0;
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    let previousMonthIncome = 0;
    let previousMonthExpenses = 0;

    const currentMonthByCategory: Record<string, number> = {};
    const previousMonthByCategory: Record<string, number> = {};

    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome += t.amount;
        if (t.date.startsWith(curMonth)) monthlyIncome += t.amount;
        if (t.date.startsWith(prevMonth)) previousMonthIncome += t.amount;
      } else {
        totalExpenses += t.amount;
        if (t.date.startsWith(curMonth)) {
          monthlyExpenses += t.amount;
          currentMonthByCategory[t.category] = (currentMonthByCategory[t.category] || 0) + t.amount;
        }
        if (t.date.startsWith(prevMonth)) {
          previousMonthByCategory[t.category] =
            (previousMonthByCategory[t.category] || 0) + t.amount;
        }
      }
    }

    const totalSavingsInGoals = goals.reduce((s, g) => s + g.currentAmount, 0);
    const savingsRatePercent =
      monthlyIncome > 0
        ? Number((((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100).toFixed(2))
        : 0;

    return {
      currency: settings.currency,
      currentMonthLabel: getMonthLabel(curMonth),
      previousMonthLabel: getMonthLabel(prevMonth),
      transactionCount: transactions.length,
      totals: {
        totalBalance: totalIncome - totalExpenses,
        monthlyIncome,
        monthlyExpenses,
        previousMonthIncome,
        previousMonthExpenses,
        totalSavingsInGoals,
        savingsRatePercent,
      },
      currentMonthByCategory,
      previousMonthByCategory,
      budgets: budgets
        .filter((b) => b.month === curMonth)
        .map((b) => {
          const spent = currentMonthByCategory[b.category] || 0;
          return {
            category: b.category,
            limit: b.limit,
            spent,
            utilizationPercent: b.limit > 0 ? Number(((spent / b.limit) * 100).toFixed(1)) : 0,
          };
        }),
      savingsGoals: goals.map((g) => ({
        title: g.title,
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        targetDate: g.targetDate,
      })),
      recentTransactions: transactions.slice(0, 15).map((t) => ({
        title: t.title,
        amount: t.amount,
        type: t.type,
        category: t.category,
        date: t.date,
        paymentMethod: t.paymentMethod,
      })),
    };
  }, [transactions, budgets, goals, settings.currency]);

  const loadConversations = useCallback(async () => {
    if (!user || isDemoMode) {
      setConversations([]);
      return;
    }
    setLoadingThreads(true);
    try {
      const token = await user.getIdToken();
      const resp = await fetch('/api/ai/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as { conversations?: ConversationSummary[] };
        setConversations(data.conversations || []);
      }
    } catch {
      // ignore non-fatal list fetch error
    } finally {
      setLoadingThreads(false);
    }
  }, [user, isDemoMode]);

  // Sync summarized portfolio snapshot & load threads for authenticated users
  useEffect(() => {
    if (!user || isDemoMode) return;
    void loadConversations();

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await user.getIdToken();
          await fetch('/api/finance/sync-snapshot', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ financialContext }),
          });
        } catch {
          // non-blocking background snapshot sync
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
  }, [user, isDemoMode, financialContext, loadConversations]);

  const handleSelectConversation = async (convId: number) => {
    if (!user || isDemoMode) return;
    try {
      const token = await user.getIdToken();
      const resp = await fetch(`/api/ai/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        conversation?: ConversationSummary;
        messages?: Array<{ id: number; role: string; content: string; model?: string }>;
      };
      setActiveConversationId(convId);
      if (data.conversation?.persona === 'budget_coach' || data.conversation?.persona === 'loan_planner') {
        setPersona(data.conversation.persona);
      } else {
        setPersona('analyst');
      }
      const hydrated: ChatMessage[] = (data.messages || []).map((m) => ({
        id: `db_${m.id}`,
        role: m.role === 'user' ? 'user' : 'assistant',
        text: m.content,
        modelLabel: m.model || undefined,
      }));
      setMessages(hydrated.length > 0 ? hydrated : [welcomeMessage]);
    } catch {
      // ignore
    }
  };

  const handleDeleteConversation = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isDemoMode) return;
    try {
      const token = await user.getIdToken();
      const resp = await fetch(`/api/ai/conversations/${convId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          setActiveConversationId(null);
          setMessages([welcomeMessage]);
        }
      }
    } catch {
      // ignore
    }
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([welcomeMessage]);
  };

  const sendMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user && !isDemoMode) {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: trimmed,
          mode: isDemoMode ? 'demo' : 'live',
          persona,
          modelMode,
          conversationId: activeConversationId,
          history: nextMessages
            .filter((m) => !m.isError && m.id !== 'welcome')
            .slice(-12)
            .map((m) => ({ role: m.role, text: m.text })),
          financialContext: isDemoMode ? undefined : financialContext,
        }),
      });

      const data = (await resp.json()) as {
        reply?: string;
        modelLabel?: string;
        conversationId?: number | null;
        error?: string;
      };
      if (!resp.ok || !data.reply) {
        throw new Error(data.error || 'Unable to generate AI insight right now.');
      }

      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
        void loadConversations();
      } else if (data.conversationId) {
        void loadConversations();
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
          modelLabel: data.modelLabel,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          isError: true,
          text: err instanceof Error ? err.message : 'Unable to reach AI service.',
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  // Cleanup Live Voice audio & WebSocket resources
  const stopVoiceSession = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => undefined);
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => undefined);
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    setVoiceSpeaking(false);
    setMicMuted(false);
    setVoiceStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  const schedulePcmAudioChunk = useCallback((base64Audio: string) => {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;

    const float32 = base64Pcm16ToFloat32(base64Audio);
    const buffer = outCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(source);
    setVoiceSpeaking(true);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setVoiceSpeaking(false);
      }
    };
    source.start(startAt);
  }, []);

  const appendTranscript = useCallback((speaker: 'user' | 'assistant', chunk: string) => {
    const clean = chunk;
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        return [...prev.slice(0, -1), { ...last, text: `${last.text}${clean}` }];
      }
      return [...prev, { id: `tr_${Date.now()}_${Math.random()}`, speaker, text: clean }];
    });
    setTimeout(() => voiceTranscriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const startVoiceSession = async () => {
    if (voiceStatus === 'connecting' || voiceStatus === 'connected') return;
    setVoiceError(null);
    setVoiceStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${wsProtocol}//${window.location.host}/api/live`;
      if (isDemoMode) {
        wsUrl += '?mode=demo';
      } else if (user) {
        const token = await user.getIdToken();
        wsUrl += `?token=${encodeURIComponent(token)}`;
      } else {
        throw new Error('Sign in or switch to Demo Preview to use Live Voice.');
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'init',
            voice: selectedVoice,
            persona,
            financialContext: isDemoMode ? undefined : financialContext,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            ready?: boolean;
            audio?: string;
            inputTranscript?: string;
            outputTranscript?: string;
            interrupted?: boolean;
            error?: string;
            closed?: boolean;
          };

          if (msg.error) {
            setVoiceError(msg.error);
            stopVoiceSession();
            setVoiceStatus('error');
            return;
          }

          if (msg.ready) {
            setVoiceStatus('connected');
            const sourceNode = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (mutedRef.current) return;
              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
              const pcmBase64 = float32ToBase64Pcm16(e.inputBuffer.getChannelData(0));
              wsRef.current.send(JSON.stringify({ audio: pcmBase64 }));
            };

            sourceNode.connect(processor);
            processor.connect(inputCtx.destination);
          }

          if (msg.audio) {
            schedulePcmAudioChunk(msg.audio);
          }

          if (msg.inputTranscript) {
            appendTranscript('user', msg.inputTranscript);
          }

          if (msg.outputTranscript) {
            appendTranscript('assistant', msg.outputTranscript);
          }

          if (msg.interrupted) {
            for (const src of activeSourcesRef.current) {
              try {
                src.stop();
              } catch {
                // ignore
              }
            }
            activeSourcesRef.current.clear();
            if (outputCtxRef.current) {
              nextStartTimeRef.current = outputCtxRef.current.currentTime;
            }
            setVoiceSpeaking(false);
          }

          if (msg.closed) {
            stopVoiceSession();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setVoiceError('Live voice WebSocket connection failed. Please try again.');
        stopVoiceSession();
        setVoiceStatus('error');
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          stopVoiceSession();
        }
      };
    } catch (err) {
      stopVoiceSession();
      setVoiceStatus('error');
      setVoiceError(
        err instanceof Error
          ? err.message
          : 'Microphone access or voice connection failed. Please allow microphone permissions.'
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-8.5rem)] min-h-[580px]">
      {/* Left Sidebar Controls */}
      <div className="lg:col-span-4 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Financial Intelligence
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isDemoMode
                    ? 'Sample Portfolio Context'
                    : `${transactions.length} transactions indexed`}
                </p>
              </div>
            </div>
          </div>

          {/* Mode Switcher: Text Chat vs Live Voice */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#101827] border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'chat'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Multi-Turn Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'voice'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Live Voice
            </button>
          </div>

          {/* Advisor Persona Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Assistant Role
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={voiceStatus === 'connected'}
                  onClick={() => setPersona(p.id)}
                  className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
                    persona === p.id
                      ? 'border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-700 dark:text-slate-300 hover:border-violet-500/30'
                  } disabled:opacity-60`}
                >
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-[11px] opacity-80">{p.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'chat' ? (
            <>
              <div>
                <label
                  htmlFor="ai-model-select"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Reasoning Mode
                </label>
                <select
                  id="ai-model-select"
                  value={modelMode}
                  onChange={(e) => setModelMode(e.target.value as ModelModeKey)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  {MODEL_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={sending}
                onClick={() =>
                  void sendMessage(
                    'Generate a concise monthly financial summary comparing my current month income, expenses, top spending categories, budget utilization, and savings progress against last month.'
                  )
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all disabled:opacity-60"
              >
                <FileText className="w-4 h-4" />
                Generate Monthly Summary
              </button>

              {/* Saved Threads for Signed-In Users */}
              {!isDemoMode && user && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <History className="w-3.5 h-3.5 text-violet-400" />
                      Recent Chats
                    </span>
                    <button
                      type="button"
                      onClick={startNewChat}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      New Chat
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {loadingThreads ? (
                      <p className="text-[11px] text-slate-400">Loading history...</p>
                    ) : conversations.length === 0 ? (
                      <p className="text-[11px] text-slate-400">
                        Your multi-turn conversations will appear here.
                      </p>
                    ) : (
                      conversations.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => void handleSelectConversation(conv.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              void handleSelectConversation(conv.id);
                            }
                          }}
                          className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            activeConversationId === conv.id
                              ? 'border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                              : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-700 dark:text-slate-300 hover:border-violet-500/30'
                          }`}
                        >
                          <span className="truncate font-medium">{conv.title}</span>
                          <button
                            type="button"
                            onClick={(e) => void handleDeleteConversation(conv.id, e)}
                            aria-label="Delete conversation"
                            className="opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-500 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Suggested Questions
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={sending}
                      onClick={() => void sendMessage(q)}
                      className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] hover:border-violet-500/40 text-xs text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="live-voice-select"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Voice Persona
                </label>
                <select
                  id="live-voice-select"
                  disabled={voiceStatus === 'connected' || voiceStatus === 'connecting'}
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Real-Time Voice Mode (Gemini 3.8 Live)
                </p>
                <p>
                  Speak naturally about your monthly spending, category budgets, or savings goals. You can interrupt the assistant mid-sentence just like a live call.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          AI responses reference your actual stored figures and clearly mark any savings estimates. Guidance is informational and not guaranteed financial or investment advice.
        </div>
      </div>

      {/* Right Main Area: Chat OR Live Voice */}
      {activeTab === 'chat' ? (
        <div className="lg:col-span-8 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                {m.role === 'assistant' && (
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      m.isError
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-violet-500/15 text-violet-500 dark:text-violet-400'
                    }`}
                  >
                    {m.isError ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : m.isError
                      ? 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      : 'border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.text}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:240ms]" />
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    Analyzing financial data...
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-3"
          >
            <input
              type="text"
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about spending trends, category spikes, or savings strategies..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              Ask AI
            </button>
          </form>
        </div>
      ) : (
        <div className="lg:col-span-8 rounded-[18px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#192438] flex flex-col overflow-hidden">
          {/* Voice Control Header */}
          <div className="p-5 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                  voiceStatus === 'connected'
                    ? voiceSpeaking
                      ? 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30'
                    : 'bg-violet-500/15 text-violet-400'
                }`}
              >
                {voiceSpeaking ? (
                  <Volume2 className="w-5 h-5 animate-pulse" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {voiceStatus === 'connected'
                    ? voiceSpeaking
                      ? 'PaisaTrack AI is speaking...'
                      : micMuted
                      ? 'Microphone muted'
                      : 'Listening — speak naturally'
                    : voiceStatus === 'connecting'
                    ? 'Connecting live voice channel...'
                    : 'Start a Live Financial Voice Call'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Voice: {selectedVoice} · Role:{' '}
                  {PERSONAS.find((p) => p.id === persona)?.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {voiceStatus === 'connected' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMicMuted((m) => !m)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      micMuted
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-500'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {micMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    type="button"
                    onClick={stopVoiceSession}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" />
                    End Call
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={voiceStatus === 'connecting'}
                  onClick={() => void startVoiceSession()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all disabled:opacity-60"
                >
                  <Mic className="w-4 h-4" />
                  {voiceStatus === 'connecting' ? 'Connecting...' : 'Start Voice Conversation'}
                </button>
              )}
            </div>
          </div>

          {voiceError && (
            <div className="mx-5 mt-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{voiceError}</span>
            </div>
          )}

          {/* Live Transcript Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-500 dark:text-slate-400 space-y-2">
                <Mic className="w-8 h-8 text-violet-400/70" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Bidirectional Live Audio Ready
                </p>
                <p className="text-xs max-w-md leading-relaxed">
                  Click &ldquo;Start Voice Conversation&rdquo; to talk directly with your PaisaTrack AI advisor about your budgets, expenses, and savings targets in real time.
                </p>
              </div>
            ) : (
              transcripts.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 ${
                    entry.speaker === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {entry.speaker === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      entry.speaker === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101827] text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {entry.text}
                  </div>
                  {entry.speaker === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={voiceTranscriptEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
