import {
  TRANSACTION_CATEGORIES,
  type PaymentMethod,
  type TransactionCategory,
  type TransactionRecord,
  type TransactionType,
} from '../types/finance';
import { suggestTransactionCategory, type PatternHistoryEntry } from './categoryEngine';
import { toIsoDate } from './formatters';

export interface ParsedVoiceTransaction {
  transcript: string;
  title: string;
  amount: number | null;
  type: TransactionType | null;
  category: TransactionCategory | null;
  categoryConfidence: number | null;
  categoryReason: string | null;
  paymentMethod: PaymentMethod | null;
  date: string | null;
}

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_NUMBERS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALE_NUMBERS: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  million: 1000000,
};

function parseSpokenNumberWords(text: string): { value: number | null; matchedText: string | null } {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let bestVal: number | null = null;
  let bestTokens: string[] = [];

  let i = 0;
  while (i < words.length) {
    const start = i;
    let total = 0;
    let current = 0;
    let matchedAny = false;

    while (i < words.length) {
      const w = words[i];
      if (w in SMALL_NUMBERS) {
        current += SMALL_NUMBERS[w];
        matchedAny = true;
      } else if (w in TENS_NUMBERS) {
        current += TENS_NUMBERS[w];
        matchedAny = true;
      } else if (w in SCALE_NUMBERS) {
        const scale = SCALE_NUMBERS[w];
        if (scale === 100) {
          current = (current === 0 ? 1 : current) * 100;
        } else {
          total += (current === 0 ? 1 : current) * scale;
          current = 0;
        }
        matchedAny = true;
      } else if (w === 'and' && matchedAny) {
        // allow "one hundred and fifty"
      } else {
        break;
      }
      i++;
    }

    if (matchedAny) {
      const val = total + current;
      if (val > 0) {
        bestVal = val;
        bestTokens = words.slice(start, i);
        break;
      }
    } else {
      i++;
    }
  }

  return {
    value: bestVal,
    matchedText: bestTokens.length > 0 ? bestTokens.join(' ') : null,
  };
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.toUpperCase() === word && word.length <= 4 && word.length >= 2) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function parseVoiceTransactionTranscript(
  rawTranscript: string,
  options: {
    history: TransactionRecord[];
    recurringHistory?: PatternHistoryEntry[];
    defaultType: TransactionType;
  }
): ParsedVoiceTransaction {
  const transcript = rawTranscript.trim();
  if (!transcript) {
    return {
      transcript: '',
      title: '',
      amount: null,
      type: null,
      category: null,
      categoryConfidence: null,
      categoryReason: null,
      paymentMethod: null,
      date: null,
    };
  }

  const lower = transcript.toLowerCase();

  // 1. Detect transaction type (income vs expense)
  const incomeRegex = /\b(received|earned|salary|credited|refund|bonus|dividend|stipend|income|got paid|payout)\b/i;
  const expenseRegex = /\b(spent|paid|bought|purchased|ordered|debited|expense|cost|charged)\b/i;

  let detectedType: TransactionType | null = null;
  if (incomeRegex.test(lower) && !/\bpaid\b/i.test(lower.replace(/\bgot paid\b/i, ''))) {
    detectedType = 'income';
  } else if (expenseRegex.test(lower)) {
    detectedType = 'expense';
  }

  // 2. Detect payment method
  let paymentMethod: PaymentMethod | null = null;
  if (/\b(upi|gpay|google pay|phonepe|paytm|bhim)\b/i.test(lower)) {
    paymentMethod = 'UPI';
  } else if (/\b(bank transfer|neft|imps|rtgs|wire|direct deposit|ach)\b/i.test(lower)) {
    paymentMethod = 'Bank Transfer';
  } else if (/\b(credit card|debit card|card|visa|mastercard|amex)\b/i.test(lower)) {
    paymentMethod = 'Card';
  } else if (/\b(cash)\b/i.test(lower)) {
    paymentMethod = 'Cash';
  } else if (/\b(wallet|apple pay|paypal|amazon pay)\b/i.test(lower)) {
    paymentMethod = 'Wallet';
  }

  // 3. Detect date cues
  let detectedDate: string | null = null;
  if (/\byesterday\b/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    detectedDate = toIsoDate(d);
  } else if (/\btoday\b/i.test(lower)) {
    detectedDate = toIsoDate(new Date());
  }

  // 4. Extract numeric amount (supports currency symbols, commas, decimals, or k suffix)
  let amount: number | null = null;
  let workingText = transcript;

  const numericPattern =
    /(?:^|\s)(?:[₹$€£]\s*|rs\.?\s*|inr\s*|usd\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(\s*k\b)?(?:\s*(?:rupees|rs\.?|inr|dollars|usd|bucks|euros|eur|pounds|gbp))?(?=\s|$|[.,!?;])/i;
  const numericMatch = workingText.match(numericPattern);

  if (numericMatch) {
    const rawNum = Number(numericMatch[1].replace(/,/g, ''));
    const hasKSuffix = Boolean(numericMatch[2]);
    if (Number.isFinite(rawNum) && rawNum > 0) {
      amount = hasKSuffix ? rawNum * 1000 : rawNum;
      workingText = workingText.replace(numericMatch[0], ' ');
    }
  } else {
    const spoken = parseSpokenNumberWords(workingText);
    if (spoken.value && spoken.matchedText) {
      amount = spoken.value;
      const escaped = spoken.matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      workingText = workingText.replace(new RegExp(`\\b${escaped}\\b`, 'i'), ' ');
    }
  }

  // 5. Check if user explicitly named a category (e.g., "category food" or "under transport")
  let explicitCategory: TransactionCategory | null = null;
  for (const cat of TRANSACTION_CATEGORIES) {
    const catLower = cat.toLowerCase();
    const explicitPattern = new RegExp(
      `\\b(?:category|under|tagged|tag)\\s+${catLower}\\b|\\b${catLower}\\s+category\\b`,
      'i'
    );
    if (explicitPattern.test(lower)) {
      explicitCategory = cat;
      workingText = workingText.replace(explicitPattern, ' ');
      break;
    }
  }

  // 6. Clean filler phrases, currency words, payment method phrases, and date cues to isolate clean title
  const cleanedTitle = workingText
    .replace(/\b(spent|paid|bought|purchased|ordered|received|earned|got paid|added|log|add|record)\b/gi, ' ')
    .replace(/\b(rupees|rupee|rs|inr|dollars|dollar|usd|bucks|euros|euro|eur|pounds|pound|gbp)\b/gi, ' ')
    .replace(/\b(via|using|through|with|by)\s+(upi|gpay|google pay|phonepe|paytm|bhim|credit card|debit card|card|bank transfer|neft|imps|cash|wallet)\b/gi, ' ')
    .replace(/\b(on|for|at|from|to|in|the|a|an|my|of|category)\b/gi, ' ')
    .replace(/\b(today|yesterday)\b/gi, ' ')
    .replace(/[₹$€£]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const finalTitle = cleanedTitle ? toTitleCase(cleanedTitle) : toTitleCase(transcript);
  const resolvedType = detectedType ?? options.defaultType;

  // 7. Run category heuristic engine against cleaned title + full transcript notes
  const suggestion = suggestTransactionCategory({
    title: finalTitle,
    notes: transcript,
    type: resolvedType,
    amount: amount ?? undefined,
    paymentMethod: paymentMethod ?? undefined,
    history: options.history,
    recurringHistory: options.recurringHistory,
  });

  let finalCategory: TransactionCategory | null = explicitCategory;
  let categoryConfidence: number | null = explicitCategory ? 99 : null;
  let categoryReason: string | null = explicitCategory ? `Matched spoken category (${explicitCategory})` : null;

  if (!finalCategory && suggestion.top && suggestion.top.confidence >= 45) {
    finalCategory = suggestion.top.category;
    categoryConfidence = suggestion.top.confidence;
    categoryReason = suggestion.top.reason;
  }

  return {
    transcript,
    title: finalTitle.slice(0, 120),
    amount,
    type: detectedType,
    category: finalCategory,
    categoryConfidence,
    categoryReason,
    paymentMethod,
    date: detectedDate,
  };
}
