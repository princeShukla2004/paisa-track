import {
  TRANSACTION_CATEGORIES,
  type PaymentMethod,
  type TransactionCategory,
  type TransactionRecord,
  type TransactionType,
} from '../types/finance';

export type SuggestionSource = 'history_exact' | 'history_pattern' | 'keyword_rule';

export interface CategorySuggestion {
  category: TransactionCategory;
  confidence: number; // 0-100
  reason: string;
  source: SuggestionSource;
}

export interface CategorySuggestionResult {
  top: CategorySuggestion | null;
  alternatives: CategorySuggestion[];
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'paid',
  'pay',
  'payment',
  'monthly',
  'weekly',
  'daily',
  'annual',
  'yearly',
  'bill',
  'bills',
  'charge',
  'charges',
  'order',
  'purchase',
  'entry',
  'transfer',
  'upi',
  'card',
  'cash',
  'bank',
]);

const KEYWORD_RULES: Record<TransactionCategory, string[]> = {
  Food: [
    'food',
    'foods',
    'eats',
    'grocery',
    'groceries',
    'swiggy',
    'zomato',
    'blinkit',
    'zepto',
    'instamart',
    'bigbasket',
    'doordash',
    'grubhub',
    'ubereats',
    'supermarket',
    'restaurant',
    'dining',
    'cafe',
    'coffee',
    'starbucks',
    'mcdonalds',
    'kfc',
    'dominos',
    'subway',
    'lunch',
    'dinner',
    'breakfast',
    'brunch',
    'bakery',
    'pizza',
    'burger',
    'tea',
    'chai',
    'snack',
    'snacks',
    'meal',
    'kitchen',
  ],
  Shopping: [
    'amazon',
    'flipkart',
    'myntra',
    'ajio',
    'nykaa',
    'meesho',
    'walmart',
    'target',
    'costco',
    'ikea',
    'zara',
    'uniqlo',
    'shopping',
    'apparel',
    'clothes',
    'wardrobe',
    'shoes',
    'sneakers',
    'accessories',
    'electronics',
    'gadget',
    'laptop',
    'lamp',
    'desk',
    'furniture',
    'mall',
    'store',
  ],
  Transport: [
    'uber',
    'ola',
    'lyft',
    'rapido',
    'grab',
    'metro',
    'cab',
    'taxi',
    'auto',
    'commute',
    'fuel',
    'petrol',
    'diesel',
    'shell',
    'ev',
    'charging',
    'parking',
    'toll',
    'fastag',
    'flight',
    'airline',
    'indigo',
    'airindia',
    'train',
    'irctc',
    'railway',
    'bus',
    'redbus',
    'travel',
    'ride',
    'pass',
  ],
  Rent: [
    'rent',
    'lease',
    'landlord',
    'apartment',
    'flat',
    'bhk',
    '2bhk',
    '3bhk',
    'housing',
    'pg',
    'hostel',
    'society',
    'maintenance',
    'deposit',
  ],
  Bills: [
    'electricity',
    'power',
    'water',
    'gas',
    'internet',
    'broadband',
    'fiber',
    'wifi',
    'jio',
    'airtel',
    'vi',
    'bsnl',
    'mobile',
    'recharge',
    'postpaid',
    'utility',
    'utilities',
    'dth',
    'cloud',
    'icloud',
    'aws',
    'domain',
    'hosting',
    'insurance',
    'premium',
    'tax',
  ],
  Healthcare: [
    'pharmacy',
    'apollo',
    'medplus',
    'pharmeasy',
    '1mg',
    'cvs',
    'walgreens',
    'hospital',
    'clinic',
    'doctor',
    'dental',
    'dentist',
    'lab',
    'checkup',
    'diagnostic',
    'medicine',
    'medicines',
    'medical',
    'health',
    'wellness',
    'vitamin',
    'vitamins',
    'therapy',
    'gym',
    'fitness',
  ],
  Education: [
    'course',
    'courses',
    'udemy',
    'coursera',
    'edx',
    'tuition',
    'school',
    'college',
    'university',
    'exam',
    'book',
    'books',
    'kindle',
    'workshop',
    'bootcamp',
    'certification',
    'class',
    'study',
  ],
  Entertainment: [
    'netflix',
    'spotify',
    'prime',
    'hotstar',
    'disney',
    'hulu',
    'youtube',
    'cinema',
    'movie',
    'movies',
    'imax',
    'pvr',
    'inox',
    'bookmyshow',
    'ticket',
    'tickets',
    'concert',
    'event',
    'gaming',
    'steam',
    'playstation',
    'xbox',
    'streaming',
    'music',
  ],
  Salary: [
    'salary',
    'payroll',
    'paycheck',
    'stipend',
    'wages',
    'bonus',
    'compensation',
    'employer',
  ],
  Freelance: [
    'freelance',
    'consulting',
    'advisory',
    'retainer',
    'client',
    'invoice',
    'audit',
    'contract',
    'upwork',
    'fiverr',
    'commission',
  ],
  Investments: [
    'dividend',
    'mutual',
    'sip',
    'zerodha',
    'groww',
    'upstox',
    'stock',
    'stocks',
    'equity',
    'etf',
    'index',
    'interest',
    'fd',
    'ppf',
    'nps',
    'bond',
    'returns',
    'payout',
  ],
  Other: [],
};

const PHRASE_RULES: Partial<Record<TransactionCategory, string[]>> = {
  Food: ['uber eats', 'whole foods', 'trader joes', 'blue bottle', 'coffee shop'],
  Shopping: ['apple store', 'amazon prime shopping'],
  Transport: ['uber trip', 'uber ride', 'ola cab', 'air india', 'metro card', 'airport cab'],
  Rent: ['house rent', 'apartment rent', 'flat rent', 'room rent'],
  Bills: ['electricity bill', 'water bill', 'internet bill', 'wifi bill', 'phone bill', 'credit card bill'],
  Healthcare: ['health checkup', 'blood test', 'dental care'],
  Entertainment: ['movie ticket', 'prime video', 'youtube premium', 'apple music'],
  Investments: ['mutual fund', 'index fund', 'fixed deposit', 'stock dividend'],
};

const INCOME_CATEGORIES = new Set<TransactionCategory>([
  'Salary',
  'Freelance',
  'Investments',
  'Other',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  const norm = normalizeText(value);
  if (!norm) return [];
  return norm
    .split(' ')
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

function hasWholePhrase(normText: string, phrase: string): boolean {
  if (!normText || !phrase) return false;
  return ` ${normText} `.includes(` ${phrase} `);
}

export interface PatternHistoryEntry {
  title: string;
  notes?: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  paymentMethod: PaymentMethod;
}

interface CandidateBucket {
  score: number;
  exactMatches: number;
  patternHits: number;
  matchedTokens: Set<string>;
  matchedTitles: string[];
  keywordHits: string[];
  amountAligned: boolean;
}

export function suggestTransactionCategory(params: {
  title: string;
  notes?: string;
  type: TransactionType;
  amount?: number;
  paymentMethod?: PaymentMethod;
  history: TransactionRecord[];
  recurringHistory?: PatternHistoryEntry[];
}): CategorySuggestionResult {
  const {
    title,
    notes = '',
    type,
    amount,
    paymentMethod,
    history,
    recurringHistory = [],
  } = params;

  const normTitle = normalizeText(title);
  const compactTitle = normTitle.replace(/\s+/g, '');
  const titleTokens = tokenize(title);
  const notesTokens = tokenize(notes);

  if (!normTitle && titleTokens.length === 0 && notesTokens.length === 0) {
    return { top: null, alternatives: [] };
  }

  const buckets = new Map<TransactionCategory, CandidateBucket>();
  for (const cat of TRANSACTION_CATEGORIES) {
    buckets.set(cat, {
      score: 0,
      exactMatches: 0,
      patternHits: 0,
      matchedTokens: new Set<string>(),
      matchedTitles: [],
      keywordHits: [],
      amountAligned: false,
    });
  }

  // 1. Historical Pattern Scoring (transactions + recurring schedules)
  const combinedHistory: PatternHistoryEntry[] = [...history, ...recurringHistory];
  const relevantHistory = combinedHistory.filter((h) => h.type === type);
  const fallbackHistory = relevantHistory.length > 0 ? relevantHistory : combinedHistory;

  // Pre-calculate token category specificity across history so rare merchant tokens weigh more
  const tokenCategorySpread = new Map<string, Set<TransactionCategory>>();
  for (const h of fallbackHistory) {
    for (const tok of tokenize(h.title)) {
      const set = tokenCategorySpread.get(tok) || new Set<TransactionCategory>();
      set.add(h.category);
      tokenCategorySpread.set(tok, set);
    }
  }

  for (let i = 0; i < fallbackHistory.length; i++) {
    const past = fallbackHistory[i];
    const bucket = buckets.get(past.category);
    if (!bucket) continue;

    // Slight recency boost for newer entries (history is typically sorted date desc)
    const recencyWeight = Math.max(0.7, 1.15 - i * 0.015);
    const sameTypeWeight = past.type === type ? 1 : 0.45;
    const pastNormTitle = normalizeText(past.title);

    let entryScore = 0;

    // Exact normalized title match
    if (normTitle && pastNormTitle && normTitle === pastNormTitle) {
      entryScore += 48;
      bucket.exactMatches += 1;
    } else if (
      normTitle.length >= 3 &&
      pastNormTitle.length >= 3 &&
      (hasWholePhrase(pastNormTitle, normTitle) ||
        hasWholePhrase(normTitle, pastNormTitle) ||
        pastNormTitle.startsWith(normTitle) ||
        (normTitle.length >= 4 && pastNormTitle.includes(normTitle)))
    ) {
      entryScore += 28;
      bucket.patternHits += 1;
      if (!bucket.matchedTitles.includes(past.title)) {
        bucket.matchedTitles.push(past.title);
      }
    }

    // Token overlap & prefix match with specificity weighting
    const pastTitleTokens = tokenize(past.title);
    const pastTitleTokenSet = new Set(pastTitleTokens);
    const pastNotesTokenSet = new Set(tokenize(past.notes || ''));

    for (const tok of titleTokens) {
      if (pastTitleTokenSet.has(tok)) {
        const spread = tokenCategorySpread.get(tok)?.size ?? 1;
        const specificity = spread <= 1 ? 1.4 : 1 / Math.sqrt(spread);
        entryScore += 18 * specificity;
        bucket.patternHits += 1;
        bucket.matchedTokens.add(tok);
      } else if (
        tok.length >= 3 &&
        pastTitleTokens.some((pastTok) => pastTok.startsWith(tok) || tok.startsWith(pastTok))
      ) {
        entryScore += 12;
        bucket.patternHits += 1;
        bucket.matchedTokens.add(tok);
      } else if (pastNotesTokenSet.has(tok)) {
        entryScore += 8;
        bucket.patternHits += 1;
        bucket.matchedTokens.add(tok);
      }
    }

    for (const nTok of notesTokens) {
      if (pastTitleTokenSet.has(nTok) || pastNotesTokenSet.has(nTok)) {
        entryScore += 6;
        bucket.matchedTokens.add(nTok);
      }
    }

    if (entryScore > 0) {
      // Amount band similarity (+10 if within ±30% of historical entry)
      if (amount && amount > 0 && past.amount > 0) {
        const ratio = Math.abs(amount - past.amount) / past.amount;
        if (ratio <= 0.3) {
          entryScore += 10;
          bucket.amountAligned = true;
        }
      }

      // Payment method tie-breaker (+4)
      if (paymentMethod && past.paymentMethod === paymentMethod) {
        entryScore += 4;
      }

      bucket.score += entryScore * recencyWeight * sameTypeWeight;
    }
  }

  // 2. Domain Phrase & Keyword Heuristics (cold-start & reinforcement)
  const combinedTokens = [...titleTokens, ...notesTokens];
  for (const cat of TRANSACTION_CATEGORIES) {
    const bucket = buckets.get(cat);
    if (!bucket) continue;

    const typeCompatibility =
      type === 'income'
        ? INCOME_CATEGORIES.has(cat)
          ? 1.15
          : 0.35
        : INCOME_CATEGORIES.has(cat) && cat !== 'Other'
        ? 0.3
        : 1;

    // Multi-word phrase rules (disambiguates e.g. "Uber Eats" -> Food vs "Uber" -> Transport)
    const phrases = PHRASE_RULES[cat] || [];
    for (const phrase of phrases) {
      if (hasWholePhrase(normTitle, phrase)) {
        bucket.score += 36 * typeCompatibility;
        if (!bucket.keywordHits.includes(phrase)) {
          bucket.keywordHits.push(phrase);
        }
      }
    }

    const keywords = KEYWORD_RULES[cat];
    if (keywords.length === 0) continue;

    for (const kw of keywords) {
      const inTitle =
        titleTokens.includes(kw) ||
        (kw.length >= 6 && compactTitle.includes(kw));
      const inNotes = notesTokens.includes(kw);
      if (inTitle || inNotes) {
        bucket.score += (inTitle ? 26 : 12) * typeCompatibility;
        if (!bucket.keywordHits.includes(kw)) {
          bucket.keywordHits.push(kw);
        }
      }
    }

    // Partial prefix match for typing mid-word (e.g. "grocer" -> "groceries", "ube" -> "uber")
    if (combinedTokens.length > 0 && bucket.keywordHits.length === 0) {
      for (const tok of titleTokens) {
        if (tok.length < 3) continue;
        const partial = keywords.find((kw) => kw.startsWith(tok));
        if (partial) {
          bucket.score += 14 * typeCompatibility;
          bucket.keywordHits.push(partial);
          break;
        }
      }
    }
  }

  // Rank candidates
  const ranked: CategorySuggestion[] = [];
  for (const cat of TRANSACTION_CATEGORIES) {
    const b = buckets.get(cat);
    if (!b || b.score < 12) continue;

    // Normalize raw score onto a clean 0-99 confidence scale
    const confidence = Math.min(99, Math.max(35, Math.round(32 + b.score * 0.85)));

    let source: SuggestionSource = 'keyword_rule';
    let reason = '';

    if (b.exactMatches > 0) {
      source = 'history_exact';
      reason = `Matched ${b.exactMatches} past "${title.trim()}" ${
        b.exactMatches === 1 ? 'entry' : 'entries'
      }${b.amountAligned ? ' & similar amount' : ''}`;
    } else if (b.patternHits > 0 && b.matchedTokens.size > 0) {
      source = 'history_pattern';
      const tokensList = Array.from(b.matchedTokens).slice(0, 2).join(', ');
      reason = `Learned from your history (${tokensList})`;
    } else if (b.patternHits > 0 && b.matchedTitles.length > 0) {
      source = 'history_pattern';
      reason = `Similar to past entry "${b.matchedTitles[0]}"`;
    } else {
      source = 'keyword_rule';
      const kwList = b.keywordHits.slice(0, 2).join(', ');
      reason = kwList
        ? `Detected keyword pattern (${kwList})`
        : 'Matched spending pattern';
    }

    ranked.push({
      category: cat,
      confidence,
      reason,
      source,
    });
  }

  ranked.sort((a, b) => b.confidence - a.confidence);

  if (ranked.length === 0) {
    return { top: null, alternatives: [] };
  }

  return {
    top: ranked[0],
    alternatives: ranked.slice(1, 3),
  };
}
