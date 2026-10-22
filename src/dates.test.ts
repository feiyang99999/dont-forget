import { describe, expect, it } from 'vitest';
import { daysUntil, nextOccurrence, normalizeReminders, urgency } from './dates.ts';
import { monthlyTotals } from './money.ts';
import type { Item } from './types.ts';

describe('date math', () => {
  it('counts days until a date-only value without timezone drift', () => {
    expect(daysUntil('2026-10-22', '2026-10-22')).toBe(0);
    expect(daysUntil('2026-10-23', '2026-10-22')).toBe(1);
    expect(daysUntil('2026-10-20', '2026-10-22')).toBe(-2);
  });

  it('colors overdue, 7 days, and 30 days', () => {
    expect(urgency('2026-10-21', '2026-10-22')).toBe('overdue');
    expect(urgency('2026-10-29', '2026-10-22')).toBe('week');
    expect(urgency('2026-11-21', '2026-10-22')).toBe('month');
    expect(urgency('2026-12-01', '2026-10-22')).toBe('later');
  });

  it('advances monthly and yearly charge dates, clamping short months', () => {
    expect(nextOccurrence('2026-12-31', 'monthly', '2026-10-22')).toBe('2026-12-31');
    expect(nextOccurrence('2026-10-22', 'monthly', '2026-10-22')).toBe('2026-10-22');
    expect(nextOccurrence('2026-01-15', 'monthly', '2026-10-22')).toBe('2026-11-15');
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-03-01')).toBe('2026-03-31');
    expect(nextOccurrence('2024-02-29', 'yearly', '2026-10-22')).toBe('2027-02-28');
  });

  it('keeps reminder offsets unique, in range, and soonest last', () => {
    expect(normalizeReminders([1, 30, 7, 7, -1, 400, 1.5])).toEqual([30, 7, 1]);
    expect(normalizeReminders([])).toEqual([]);
  });
});

describe('monthly subscription totals', () => {
  it('normalizes yearly prices and keeps currencies apart', () => {
    const monthly = {
      id: 'a', kind: 'subscription', name: '云盘', category: 'subscription', personId: 'person-me',
      amount: 30, currency: 'CNY', validFrom: null, validUntil: '2026-11-01', cycle: 'monthly',
      reminders: [7], notes: '', sourceText: '', thumbnail: null, createdAt: 1, updatedAt: 1, history: [],
    } satisfies Item;
    const yearly = { ...monthly, id: 'b', name: '保险会员', amount: 120, cycle: 'yearly' } satisfies Item;
    const usd = { ...monthly, id: 'c', amount: 10, currency: 'USD' } satisfies Item;
    expect(monthlyTotals([monthly, yearly, usd])).toEqual([
      { currency: 'CNY', monthly: 40 },
      { currency: 'USD', monthly: 10 },
    ]);
  });
});
