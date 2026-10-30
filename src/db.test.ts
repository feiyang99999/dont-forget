import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { keepThumbnail, parseBackup, serializeBackup } from './backup.ts';
import { clearAll, deleteDatabase, deleteItem, getMeta, loadAll, mergeItems, replaceAll, saveItem, setMeta } from './db.ts';
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

  it('keeps a saved photo in the backup, and a bad photo cannot drop the record', async () => {
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const webp = 'data:image/webp;base64,UklGRg==';
    const license = {
      ...policy(),
      id: 'license-1',
      name: '驾驶证',
      category: 'car' as const,
      thumbnail: keepThumbnail(jpeg),
    };
    await saveItem(license);
    await saveItem({ ...license, id: 'license-png', thumbnail: keepThumbnail(png) });
    await saveItem({ ...license, id: 'license-webp', thumbnail: keepThumbnail(webp) });

    const huge = `data:image/jpeg;base64,${'A'.repeat(400_001)}`;
    const remote = 'https://example.com/license.jpg';
    expect(keepThumbnail(huge)).toBeNull();
    expect(keepThumbnail(remote)).toBeNull();
    await saveItem({ ...license, id: 'license-huge', thumbnail: keepThumbnail(huge) });
    await saveItem({ ...license, id: 'license-remote', thumbnail: keepThumbnail(remote) });

    const stored = await loadAll();
    const json = serializeBackup(stored.people, stored.items, new Date('2026-10-30T00:00:00Z'));
    const file = JSON.parse(json) as { people: { id: string }[]; items: { id: string; name: string; thumbnail: string | null; category: string }[] };
    expect(file.people.map((person) => person.id)).toEqual(expect.arrayContaining(['person-me', 'person-spouse', 'person-child', 'person-parents']));
    expect(file.items.map((item) => item.id).sort()).toEqual(['license-1', 'license-huge', 'license-png', 'license-remote', 'license-webp']);
    expect(file.items.find((item) => item.id === 'license-1')).toMatchObject({ name: '驾驶证', category: 'car', thumbnail: jpeg });
    expect(file.items.find((item) => item.id === 'license-png')?.thumbnail).toBe(png);
    expect(file.items.find((item) => item.id === 'license-webp')?.thumbnail).toBe(webp);
    expect(file.items.find((item) => item.id === 'license-huge')?.thumbnail).toBeNull();
    expect(file.items.find((item) => item.id === 'license-remote')?.thumbnail).toBeNull();
    expect(parseBackup(json).items).toHaveLength(5);
  });

  it('keeps a record saved while the first IndexedDB read was still empty', () => {
    const license = { ...policy(), id: 'license-1', name: '驾驶证', category: 'car' as const };
    const merged = mergeItems([], [license]);
    const json = serializeBackup(people, merged, new Date('2026-10-30T00:00:00Z'));
    const file = JSON.parse(json) as { items: { name: string; thumbnail: string }[] };
    expect(file.items).toHaveLength(1);
    expect(file.items[0]?.name).toBe('驾驶证');
    expect(file.items[0]?.thumbnail).toBe(license.thumbnail);
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
