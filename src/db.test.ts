import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup.ts';
import { clearAll, deleteDatabase, deleteItem, getMeta, loadAll, replaceAll, saveItem, setMeta } from './db.ts';
import type { Item, Person } from './types.ts';

const people: Person[] = [
  { id: 'person-me', name: '我', createdAt: 1 },
  { id: 'person-child', name: '小孩', createdAt: 2 },
];

function policy(): Item {
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
    sourceText: '平安保险单\n保费：¥1,280.00\n有效期至：2026年12月31日',
    thumbnail: 'data:image/jpeg;base64,thumb',
    createdAt: 10,
    updatedAt: 20,
    history: [{
      id: 'rev-1',
      name: '平安保险单',
      category: 'insurance',
      personId: 'person-me',
      amount: 1000,
      currency: 'CNY',
      validFrom: '2025-01-01',
      validUntil: '2025-12-31',
      cycle: null,
      dueDay: null,
      dueMonth: null,
      seriesUntil: null,
      seriesCount: null,
      reminders: [30, 7, 1],
      notes: '上年',
      sourceText: '旧原文 有效期至2025年12月31日',
      thumbnail: 'data:image/jpeg;base64,old',
      recordedAt: 5,
      supersededAt: 10,
    }],
  };
}

describe('IndexedDB and backup round-trip', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it('seeds people, stores verbatim text, and reloads it', async () => {
    const first = await loadAll();
    expect(first.items).toEqual([]);
    expect(first.people.map((person) => person.name)).toEqual(['我', '伴侣', '孩子', '父母']);
    expect((await loadAll()).people.map((person) => person.name)).toEqual(['我', '伴侣', '孩子', '父母']);

    await saveItem(policy());
    await setMeta('lang', 'en');
    const loaded = await loadAll();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]?.sourceText).toContain('¥1,280.00');
    expect(loaded.items[0]?.thumbnail).toBe('data:image/jpeg;base64,thumb');
    expect(loaded.items[0]?.history[0]?.sourceText).toContain('2025');
    expect(await getMeta('lang')).toBe('en');
  });

  it('round-trips a JSON backup through IndexedDB', async () => {
    const original = policy();
    const json = serializeBackup(people, [original], new Date('2026-10-22T00:00:00Z'));
    const parsed = parseBackup(json);
    expect(parsed.items[0]?.sourceText).toBe(original.sourceText);
    expect(parsed.items[0]?.history[0]?.thumbnail).toBe('data:image/jpeg;base64,old');

    await saveItem({ ...original, id: 'stale', sourceText: 'should be replaced' });
    await replaceAll(parsed.people, parsed.items);
    const loaded = await loadAll();
    expect(loaded.people.map((person) => person.name)).toEqual(['我', '小孩']);
    expect(loaded.items.map((item) => item.id)).toEqual(['policy-1']);
    expect(loaded.items[0]).toEqual(original);
  });

  it('deletes one item and can wipe the library', async () => {
    await saveItem(policy());
    await saveItem({ ...policy(), id: 'other', name: '护照' });
    await deleteItem('policy-1');
    expect((await loadAll()).items.map((item) => item.id)).toEqual(['other']);
    await clearAll();
    const emptied = await loadAll();
    expect(emptied.items).toEqual([]);
    expect(emptied.people).toHaveLength(4);
    expect(await getMeta('lang')).toBeNull();
  });

  it('rejects a file that is not this app', () => {
    expect(() => parseBackup('{')).toThrow(/bad-backup/);
    expect(() => parseBackup('{"app":"other","version":1,"people":[],"items":[]}')).toThrow(/bad-backup/);
  });

  it('drops a thumbnail that would request another site', () => {
    const json = serializeBackup(people, [policy()]);
    const file = JSON.parse(json) as { items: { thumbnail: string; history: { thumbnail: string }[] }[] };
    file.items[0]!.thumbnail = 'https://example.com/photo.jpg';
    file.items[0]!.history[0]!.thumbnail = 'javascript:alert(1)';
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.items[0]?.thumbnail).toBeNull();
    expect(parsed.items[0]?.history[0]?.thumbnail).toBeNull();
    expect(parsed.items[0]?.sourceText).toContain('有效期至');
  });
});
