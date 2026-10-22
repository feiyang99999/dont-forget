import { describe, expect, it } from 'vitest';
import { searchItems } from './search.ts';
import type { Item } from './types.ts';

function item(partial: Partial<Item>): Item {
  return {
    id: partial.id ?? '1',
    kind: 'expiry',
    name: '护照',
    category: 'document',
    personId: 'person-me',
    amount: null,
    currency: null,
    validFrom: null,
    validUntil: '2030-01-01',
    cycle: null,
    dueDay: null,
    dueMonth: null,
    seriesUntil: null,
    seriesCount: null,
    reminders: [30],
    notes: '',
    sourceText: '',
    thumbnail: null,
    createdAt: 1,
    updatedAt: 1,
    history: [],
    ...partial,
  };
}

describe('scoped literal search', () => {
  const items = [
    item({ id: 'me', personId: 'person-me', category: 'document', sourceText: 'PASSPORT E12345678' }),
    item({ id: 'spouse', personId: 'person-spouse', category: 'insurance', name: '配偶保单', sourceText: '保单号 PA-9' }),
    item({
      id: 'old',
      personId: 'person-me',
      category: 'insurance',
      name: '当前保单',
      sourceText: '新原文',
      history: [{
        id: 'h', name: '旧保单', category: 'insurance', personId: 'person-me', amount: 10, currency: 'CNY',
        validFrom: '2020-01-01', validUntil: '2024-01-01', cycle: null, dueDay: null, dueMonth: null, seriesUntil: null, seriesCount: null, reminders: [], notes: '',
        sourceText: '旧保单号 ZA-1', thumbnail: null, recordedAt: 1, supersededAt: 2,
      }],
    }),
  ];

  it('matches raw OCR text and can limit by person and category', () => {
    expect(searchItems(items, { query: 'e12345678', personId: 'all', category: 'all' }).map((hit) => hit.item.id)).toEqual(['me']);
    expect(searchItems(items, { query: 'PA-9', personId: 'person-me', category: 'all' })).toEqual([]);
    expect(searchItems(items, { query: '', personId: 'person-spouse', category: 'insurance' }).map((hit) => hit.item.id)).toEqual(['spouse']);
  });

  it('finds a phrase that survives only in superseded text', () => {
    const hits = searchItems(items, { query: 'ZA-1', personId: 'all', category: 'all' });
    expect(hits).toEqual([{ item: items[2], historyMatch: true }]);
  });
});
