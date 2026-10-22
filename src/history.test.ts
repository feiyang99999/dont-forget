import { describe, expect, it } from 'vitest';
import { supersedeItem, timelineOf } from './history.ts';
import type { Item } from './types.ts';

function item(partial: Partial<Item> = {}): Item {
  return {
    id: 'policy-1',
    kind: 'expiry',
    name: '平安保险单',
    category: 'insurance',
    personId: 'person-me',
    amount: 1280,
    currency: 'CNY',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    cycle: null,
    dueDay: null,
    dueMonth: null,
    seriesUntil: null,
    seriesCount: null,
    reminders: [30, 7, 1],
    notes: '第一年',
    sourceText: '原文：有效期至2026年12月31日',
    thumbnail: 'data:image/jpeg;base64,old',
    createdAt: 10,
    updatedAt: 20,
    history: [],
    ...partial,
  };
}

describe('renewal history', () => {
  it('keeps the old verbatim text when a new term supersedes it', () => {
    const next = supersedeItem(item(), {
      name: '平安保险单',
      category: 'insurance',
      personId: 'person-spouse',
      amount: 1400,
      currency: 'CNY',
      validFrom: '2026-12-31',
      validUntil: '2027-12-31',
      cycle: null,
      dueDay: null,
      dueMonth: null,
      seriesUntil: null,
      seriesCount: null,
      reminders: [30, 7],
      notes: '续了一年',
      sourceText: '原文：有效期至2027年12月31日',
      thumbnail: 'data:image/jpeg;base64,new',
    }, 99, 'rev-1');

    expect(next.validUntil).toBe('2027-12-31');
    expect(next.sourceText).toContain('2027');
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      id: 'rev-1',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      sourceText: '原文：有效期至2026年12月31日',
      thumbnail: 'data:image/jpeg;base64,old',
      supersededAt: 99,
    });
    const timeline = timelineOf(next);
    expect(timeline.map((entry) => entry.label)).toEqual(['current', 'superseded']);
    expect(timeline[1]?.sourceText).toContain('2026年12月31日');
  });
});
