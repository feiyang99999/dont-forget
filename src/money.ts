import type { Item, Lang } from './types.ts';

export function formatMoney(amount: number, currency: string, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function monthlyAmount(item: Item): number | null {
  if (item.kind !== 'subscription' || item.amount == null) return null;
  return item.cycle === 'yearly' ? item.amount / 12 : item.amount;
}

export function monthlyTotals(items: Item[]): { currency: string; monthly: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const monthly = monthlyAmount(item);
    if (monthly == null) continue;
    const currency = item.currency || 'CNY';
    totals.set(currency, (totals.get(currency) ?? 0) + monthly);
  }
  return [...totals.entries()]
    .map(([currency, monthly]) => ({ currency, monthly }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
