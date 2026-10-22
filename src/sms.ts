import type { Category, Cycle } from './types.ts';
import { parseAmount } from './dates.ts';

const BANKS = ['中国银行', '招商银行', '工商银行', '建设银行', '农业银行', '交通银行', '浦发银行', '民生银行', '兴业银行', '中信银行', '光大银行', '平安银行', '邮储银行', '华夏银行', '广发银行', '北京银行', '上海银行', '宁波银行'];

export interface SmsGuess {
  title: string;
  category: Category;
  amount: number | null;
  currency: string | null;
  validUntil: string | null;
  bank: string | null;
  cardTail: string | null;
  dueDay: number | null;
  cycle: Cycle | null;
  sourceText: string;
}

export function maskCardNumbers(text: string): string {
  return text.replace(/\d(?:[ -]?\d){14,18}/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 15 || digits.length > 19) return match;
    return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
  });
}

function bankName(text: string): string | null {
  const bracket = text.match(/【([^】]{2,20})】/);
  const pool = bracket ? `${bracket[1]} ${text}` : text;
  const found = BANKS.find((bank) => pool.includes(bank));
  return found ?? null;
}

function cardTail(text: string): string | null {
  const labeled = text.match(/尾号\s*(\d{4})/);
  if (labeled?.[1]) return labeled[1];
  const masked = text.match(/\*{6,}(\d{4})/);
  return masked?.[1] ?? null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dated(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, last))}`;
}

function dueFrom(fragment: string, today: string): { iso: string; day: number } | null {
  const full = fragment.match(/(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})/);
  if (full?.[1] && full[2] && full[3]) {
    const month = Number(full[2]);
    const day = Number(full[3]);
    return { iso: dated(Number(full[1]), month, day), day };
  }
  const short = fragment.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (!short?.[1] || !short[2]) return null;
  const month = Number(short[1]);
  const day = Number(short[2]);
  const year = Number(today.slice(0, 4));
  const thisYear = dated(year, month, day);
  return { iso: thisYear >= today ? thisYear : dated(year + 1, month, day), day };
}

function amountFrom(text: string): number | null {
  const match = text.match(/(?:本期应还金额|本期应还|应还金额|应还)\s*(?:为|人民币|是|[:：])?\s*[¥￥]?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)/);
  return match?.[1] ? parseAmount(match[1]) : null;
}

/** Local reading of a pasted credit-card or loan reminder. No network. */
export function parseSms(raw: string, today: string): SmsGuess {
  const sourceText = maskCardNumbers(raw).trim();
  const bank = bankName(sourceText);
  const tail = cardTail(sourceText);
  const labeled = sourceText.match(/(?:最后还款日|还款日)\s*(?:为|[:：])?\s*([0-9]{4}\s*[-/年]\s*[0-9]{1,2}\s*[-/月]\s*[0-9]{1,2}\s*日?|[0-9]{1,2}\s*月\s*[0-9]{1,2}\s*日?)/);
  const due = dueFrom(labeled?.[1] ?? '', today);
  const loan = /房贷/.test(sourceText);
  const repeating = /房贷|信用卡|本期应还|最后还款日|还款日/.test(sourceText);
  const amount = amountFrom(sourceText);
  const title = loan
    ? `${bank ?? ''}房贷`.trim()
    : /信用卡/.test(sourceText)
      ? [bank, '信用卡', tail ? `尾号${tail}` : ''].filter(Boolean).join('')
      : [bank, '还款', tail ? `尾号${tail}` : ''].filter(Boolean).join('') || '还款提醒';
  return {
    title,
    category: loan ? 'house' : 'money',
    amount,
    currency: amount == null ? null : 'CNY',
    validUntil: due?.iso ?? null,
    bank,
    cardTail: tail,
    dueDay: due && repeating ? due.day : null,
    cycle: repeating && due ? 'monthly' : null,
    sourceText,
  };
}
