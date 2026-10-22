import type { Category, Extraction } from './types.ts';
import { normalizeText } from './text.ts';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_PATTERN = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

interface FoundDate {
  iso: string;
  start: number;
  end: number;
  expiryScore: number;
  fromScore: number;
}

interface FoundAmount {
  value: number;
  currency: string;
  start: number;
  end: number;
  score: number;
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function contextBefore(text: string, start: number): string {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const sameLine = text.slice(lineStart, start);
  if (sameLine.trim().length >= 2) return sameLine.slice(-80);
  const prevStart = text.lastIndexOf('\n', lineStart - 2) + 1;
  return text.slice(prevStart, start).slice(-80);
}

function scoreExpiry(context: string): number {
  let positive = 0;
  let negative = 0;
  const positives: [RegExp, number][] = [
    [/有效期至|有效期到|有效期限|证件有效期/, 100],
    [/到期日|到期时间|到期/, 85],
    [/截止日期|截止日/, 90],
    [/失效/, 60],
    [/下次扣款|扣款日|续费|续保|续期/, 70],
    [/valid\s*until|valid\s*thru|valid\s*through/i, 100],
    [/expir(?:y|es|ation|e)/i, 90],
    [/due\s*date|due\s*on|payment\s*due|缴费日期/i, 85],
    [/renew(?:al|s)?|renew\s*by/i, 70],
  ];
  const negatives: [RegExp, number][] = [
    [/出生|生日|date\s*of\s*birth|\bdob\b/i, 120],
    [/签发|issue\s*date|date\s*of\s*issue|生效|起保|起始|valid\s*from|effective/i, 90],
  ];
  for (const [pattern, weight] of positives) if (pattern.test(context)) positive += weight;
  for (const [pattern, weight] of negatives) if (pattern.test(context)) negative += weight;
  if (positive >= 80) return positive;
  return positive - negative;
}

function scoreFrom(context: string): number {
  let positive = 0;
  let negative = 0;
  const positives: [RegExp, number][] = [
    [/生效日期|生效|起保|起始日|起始/, 80],
    [/签发日期|签发/, 70],
    [/valid\s*from|effective\s*(date|from)|date\s*of\s*issue|issue\s*date/i, 80],
  ];
  const negatives: [RegExp, number][] = [
    [/出生|生日|date\s*of\s*birth|\bdob\b/i, 120],
    [/到期|截止|失效|expir|valid\s*until|due\s*date|renew/i, 80],
  ];
  for (const [pattern, weight] of positives) if (pattern.test(context)) positive += weight;
  for (const [pattern, weight] of negatives) if (pattern.test(context)) negative += weight;
  if (positive >= 70) return positive;
  return positive - negative;
}

function boundaryBonus(text: string, index: number): { from: number; expiry: number } {
  const prefix = text.slice(Math.max(0, index - 8), index);
  return {
    from: /自\s*[:：]?\s*$/.test(prefix) ? 70 : 0,
    expiry: /(?:至|到)\s*[:：]?\s*$/.test(prefix) ? 60 : 0,
  };
}

function addDate(dates: FoundDate[], text: string, iso: string | null, start: number, end: number) {
  if (!iso) return;
  if (dates.some((found) => found.iso === iso && Math.abs(found.start - start) < 2)) return;
  const context = contextBefore(text, start);
  const bonus = boundaryBonus(text, start);
  dates.push({
    iso,
    start,
    end,
    expiryScore: scoreExpiry(context) + bonus.expiry,
    fromScore: scoreFrom(context) + bonus.from,
  });
}

function findDates(text: string): FoundDate[] {
  const dates: FoundDate[] = [];
  const chinese = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g;
  const iso = /(?<!\d)(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)/g;
  const numeric = /(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/g;
  const monthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi');
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?,?\\s+(\\d{4})\\b`, 'gi');

  for (const match of text.matchAll(chinese)) {
    addDate(dates, text, isoFromParts(Number(match[1]), Number(match[2]), Number(match[3])), match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(iso)) {
    addDate(dates, text, isoFromParts(Number(match[1]), Number(match[2]), Number(match[3])), match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(numeric)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    let resolved: string | null = null;
    if (first > 12 && second <= 12) resolved = isoFromParts(year, second, first);
    else if (second > 12 && first <= 12) resolved = isoFromParts(year, first, second);
    else if (first <= 12 && second <= 12) resolved = isoFromParts(year, second, first);
    addDate(dates, text, resolved, match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(monthFirst)) {
    const month = MONTHS[(match[1] ?? '').toLowerCase()];
    addDate(dates, text, month ? isoFromParts(Number(match[3]), month, Number(match[2])) : null, match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(dayFirst)) {
    const month = MONTHS[(match[2] ?? '').toLowerCase()];
    addDate(dates, text, month ? isoFromParts(Number(match[3]), month, Number(match[1])) : null, match.index, match.index + match[0].length);
  }
  return dates;
}

function pickExpiry(dates: FoundDate[]): FoundDate | null {
  const pool = dates.filter((date) => date.expiryScore >= 0);
  pool.sort((a, b) => b.expiryScore - a.expiryScore || b.start - a.start);
  return pool[0] ?? null;
}

function pickFrom(dates: FoundDate[], until: string | null): FoundDate | null {
  const pool = dates.filter((date) => date.fromScore > 0 && date.iso !== until && (!until || date.iso < until));
  pool.sort((a, b) => b.fromScore - a.fromScore || a.start - b.start);
  return pool[0] ?? null;
}

const NUMBER = '((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)';

function parseNumber(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value > 1e8) return null;
  return Math.round(value * 100) / 100;
}

function findAmounts(text: string): FoundAmount[] {
  const patterns: { re: RegExp; currency: string }[] = [
    { re: new RegExp(`HK\\$\\s*${NUMBER}`, 'gi'), currency: 'HKD' },
    { re: new RegExp(`(?:CNY|RMB)\\s*${NUMBER}`, 'gi'), currency: 'CNY' },
    { re: new RegExp(`USD\\s*${NUMBER}`, 'gi'), currency: 'USD' },
    { re: new RegExp(`EUR\\s*${NUMBER}`, 'gi'), currency: 'EUR' },
    { re: new RegExp(`GBP\\s*${NUMBER}`, 'gi'), currency: 'GBP' },
    { re: new RegExp(`JPY\\s*${NUMBER}`, 'gi'), currency: 'JPY' },
    { re: new RegExp(`[¥￥]\\s*${NUMBER}`, 'g'), currency: 'CNY' },
    { re: new RegExp(`\\$\\s*${NUMBER}`, 'g'), currency: 'USD' },
    { re: new RegExp(`€\\s*${NUMBER}`, 'g'), currency: 'EUR' },
    { re: new RegExp(`£\\s*${NUMBER}`, 'g'), currency: 'GBP' },
    { re: new RegExp(`${NUMBER}\\s*(?:港币|港元)`, 'g'), currency: 'HKD' },
    { re: new RegExp(`${NUMBER}\\s*日元`, 'g'), currency: 'JPY' },
    { re: new RegExp(`${NUMBER}\\s*美元`, 'g'), currency: 'USD' },
    { re: new RegExp(`${NUMBER}\\s*欧元`, 'g'), currency: 'EUR' },
    { re: new RegExp(`${NUMBER}\\s*英镑`, 'g'), currency: 'GBP' },
    { re: new RegExp(`${NUMBER}\\s*元`, 'g'), currency: 'CNY' },
  ];
  const found: FoundAmount[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.re)) {
      const raw = match[1];
      if (!raw) continue;
      const value = parseNumber(raw);
      if (value == null) continue;
      const start = match.index ?? 0;
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const context = text.slice(lineStart, start).slice(-40);
      let currency = pattern.currency;
      if (currency === 'CNY' && /日元|JPY/i.test(context)) currency = 'JPY';
      let score = 0;
      if (/保费|保险费|premium/i.test(context)) score += 80;
      if (/合计|应付|金额|amount\s*due|total|缴费/i.test(context)) score += 60;
      if (/价格|费用|月租|租金|年费|月费|price|fee/i.test(context)) score += 40;
      if (/保额|sum\s*insured|coverage/i.test(context)) score -= 50;
      found.push({ value, currency, start, end: start + match[0].length, score });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: FoundAmount[] = [];
  for (const amount of found) {
    const overlapIndex = kept.findIndex((existing) => !(amount.end <= existing.start || amount.start >= existing.end));
    if (overlapIndex === -1) {
      kept.push(amount);
      continue;
    }
    const existing = kept[overlapIndex];
    if (!existing) continue;
    const longer = amount.end - amount.start > existing.end - existing.start;
    if (amount.score > existing.score || (amount.score === existing.score && longer)) kept[overlapIndex] = amount;
  }
  kept.sort((a, b) => b.score - a.score || a.start - b.start);
  return kept;
}

function guessCategory(text: string): Category {
  const rules: { category: Category; pattern: RegExp; weight: number }[] = [
    { category: 'insurance', pattern: /保险单|保险|保单|保费|被保险人|\binsurance\b|\bpolicy\b|\bpremium\b/i, weight: 2 },
    { category: 'id', pattern: /护照|身份证|通行证|驾驶证|签证|\bpassport\b|\bid\s*card\b|\bvisa\b/i, weight: 2 },
    { category: 'contract', pattern: /合同|协议|租赁|\bcontract\b|\bagreement\b|\blease\b/i, weight: 2 },
    { category: 'subscription', pattern: /订阅|会员|连续包月|年费|月费|\bsubscription\b|\bmembership\b|\brenewal\b/i, weight: 2 },
    { category: 'bill', pattern: /账单|发票|电费|水费|燃气|话费|缴费|\binvoice\b|\bbill\b|amount\s+due|payment\s+due/i, weight: 2 },
  ];
  const scores = new Map<Category, number>();
  for (const rule of rules) {
    const hits = text.match(new RegExp(rule.pattern.source, 'gi'));
    if (!hits?.length) continue;
    scores.set(rule.category, (scores.get(rule.category) ?? 0) + hits.length * rule.weight);
  }
  const priority: Category[] = ['insurance', 'id', 'contract', 'subscription', 'bill'];
  let best: Category = 'other';
  let bestScore = 0;
  for (const category of priority) {
    const score = scores.get(category) ?? 0;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

function isMostlyDate(line: string): boolean {
  const stripped = line.replace(/[\d年月日./:\-\s,]/g, '');
  return stripped.length < 2;
}

const DOC_LINE = /保险单|保单|护照|身份证|合同|协议|账单|发票|会员|passport|policy|invoice|contract|agreement|subscription/i;

function guessTitle(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length >= 2 && line.length <= 48);
  const docs = lines.filter((line) => DOC_LINE.test(line) && !isMostlyDate(line));
  const preferred = docs.find((line) => /[\u4e00-\u9fff]/.test(line)) ?? docs[0];
  if (preferred) return preferred.replace(/\s+/g, ' ').slice(0, 40);
  const named = text.match(/(?:被保险人|姓名)\s*:\s*([^\n]{1,20})/);
  if (named?.[1]) return named[1].trim().slice(0, 40);
  const first = lines.find((line) => !isMostlyDate(line));
  return first ? first.slice(0, 40) : '';
}

/** Rule-based extraction. Safe to run again on stored raw OCR text. */
export function extractDocument(raw: string): Extraction {
  const text = normalizeText(raw);
  if (!text) {
    return { title: '', category: 'other', amount: null, currency: null, validFrom: null, validUntil: null };
  }
  const dates = findDates(text);
  const until = pickExpiry(dates);
  const from = pickFrom(dates, until?.iso ?? null);
  const amount = findAmounts(text)[0] ?? null;
  return {
    title: guessTitle(text),
    category: guessCategory(text),
    amount: amount?.value ?? null,
    currency: amount?.currency ?? null,
    validFrom: from?.iso ?? null,
    validUntil: until?.iso ?? null,
  };
}

export { normalizeText };
