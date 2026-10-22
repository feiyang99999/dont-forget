import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup.ts';
import { CATEGORIES, TEMPLATES, mapLegacyCategory } from './templates.ts';

describe('categories and templates', () => {
  it('maps v1 categories onto the household list', () => {
    expect(mapLegacyCategory('id')).toBe('document');
    expect(mapLegacyCategory('bill')).toBe('money');
    expect(mapLegacyCategory('contract')).toBe('house');
    expect(mapLegacyCategory('other')).toBe('household');
    expect(mapLegacyCategory('insurance')).toBe('insurance');
    expect(mapLegacyCategory('subscription')).toBe('subscription');
    expect(mapLegacyCategory('document')).toBe('document');
    expect(mapLegacyCategory('nope')).toBe('household');
  });

  it('offers a template for each new category, including the monthly and yearly examples', () => {
    expect(CATEGORIES).toEqual(['document', 'car', 'house', 'money', 'insurance', 'health', 'subscription', 'household', 'child']);
    for (const category of CATEGORIES) {
      expect(TEMPLATES.some((template) => template.category === category)).toBe(true);
    }
    expect(TEMPLATES.find((template) => template.nameZh === '房贷')).toMatchObject({
      category: 'house', cycle: 'monthly', reminders: [3, 1],
    });
    expect(TEMPLATES.find((template) => template.nameZh === '信用卡还款')).toMatchObject({
      category: 'money', cycle: 'monthly', reminders: [3, 1],
    });
    expect(TEMPLATES.find((template) => template.nameZh === '年检')).toMatchObject({
      category: 'car', cycle: 'yearly',
    });
    expect(TEMPLATES.find((template) => template.nameZh.startsWith('个税'))).toMatchObject({
      category: 'money', cycle: 'yearly', dueMonth: 6, dueDay: 30,
    });
    for (const template of TEMPLATES) {
      expect(template.nameEn.length).toBeGreaterThan(0);
      expect(template.reminders.length).toBeGreaterThan(0);
    }
  });
});

describe('old backups', () => {
  it('imports an expiry-butler v1 file and writes bie-wang-le v2', () => {
    const old = JSON.stringify({
      app: 'expiry-butler',
      version: 1,
      exportedAt: '2026-10-22T00:00:00.000Z',
      people: [{ id: 'person-me', name: '我', createdAt: 1 }],
      items: [{
        id: 'passport',
        kind: 'expiry',
        name: '护照',
        category: 'id',
        personId: 'person-me',
        amount: null,
        currency: null,
        validFrom: null,
        validUntil: '2030-01-01',
        cycle: null,
        reminders: [30, 7, 1],
        notes: '',
        sourceText: '护照原文',
        thumbnail: null,
        createdAt: 1,
        updatedAt: 1,
        history: [],
      }],
    });
    const parsed = parseBackup(old);
    expect(parsed.items[0]).toMatchObject({
      category: 'document',
      sourceText: '护照原文',
      dueDay: null,
      dueMonth: null,
      seriesUntil: null,
      seriesCount: null,
    });
    const saved = JSON.parse(serializeBackup(parsed.people, parsed.items, new Date('2026-10-22T00:00:00Z'))) as {
      app: string;
      version: number;
    };
    expect(saved.app).toBe('bie-wang-le');
    expect(saved.version).toBe(2);
  });
});
