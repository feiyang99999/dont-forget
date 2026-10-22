import type { Cycle, Item, ItemKind, Person, Revision } from './types.ts';
import { mapLegacyCategory } from './templates.ts';

export interface BackupFile {
  app: 'bie-wang-le';
  version: 2;
  exportedAt: string;
  people: Person[];
  items: Item[];
}

const KINDS = new Set<ItemKind>(['expiry', 'subscription']);
const CYCLES = new Set<Cycle>(['monthly', 'yearly']);

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** Only in-app JPEG/PNG/WebP data URLs. A remote thumbnail would phone home when drawn. */
function asThumbnail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > 400_000) return null;
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return null;
  return value;
}

function asAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asReminders(value: unknown): number[] {
  if (!Array.isArray(value)) return [30, 7, 1];
  return value.filter((entry): entry is number => typeof entry === 'number' && Number.isInteger(entry));
}

function asDay(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max ? value : null;
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 600 ? value : null;
}

function sanitizeRevision(raw: unknown): Revision {
  if (!raw || typeof raw !== 'object') throw new Error('bad-backup');
  const row = raw as Record<string, unknown>;
  if (typeof row.validUntil !== 'string') throw new Error('bad-backup');
  return {
    id: asString(row.id, crypto.randomUUID()),
    name: asString(row.name, '未命名'),
    category: mapLegacyCategory(asString(row.category)),
    personId: asString(row.personId, 'person-me'),
    amount: asAmount(row.amount),
    currency: asNullableString(row.currency),
    validFrom: asNullableString(row.validFrom),
    validUntil: row.validUntil,
    cycle: CYCLES.has(row.cycle as Cycle) ? row.cycle as Cycle : null,
    dueDay: asDay(row.dueDay, 31),
    dueMonth: asDay(row.dueMonth, 12),
    seriesUntil: asNullableString(row.seriesUntil),
    seriesCount: asCount(row.seriesCount),
    reminders: asReminders(row.reminders),
    notes: asString(row.notes),
    sourceText: asString(row.sourceText),
    thumbnail: asThumbnail(row.thumbnail),
    recordedAt: typeof row.recordedAt === 'number' ? row.recordedAt : 0,
    supersededAt: typeof row.supersededAt === 'number' ? row.supersededAt : 0,
  };
}

function sanitizeItem(raw: unknown): Item {
  if (!raw || typeof raw !== 'object') throw new Error('bad-backup');
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.validUntil !== 'string') throw new Error('bad-backup');
  const kind = KINDS.has(row.kind as ItemKind) ? row.kind as ItemKind : 'expiry';
  return {
    id: row.id,
    kind,
    name: asString(row.name, '未命名'),
    category: kind === 'subscription' ? 'subscription' : mapLegacyCategory(asString(row.category)),
    personId: asString(row.personId, 'person-me'),
    amount: asAmount(row.amount),
    currency: asNullableString(row.currency),
    validFrom: asNullableString(row.validFrom),
    validUntil: row.validUntil,
    cycle: CYCLES.has(row.cycle as Cycle) ? row.cycle as Cycle : null,
    dueDay: asDay(row.dueDay, 31),
    dueMonth: asDay(row.dueMonth, 12),
    seriesUntil: asNullableString(row.seriesUntil),
    seriesCount: asCount(row.seriesCount),
    reminders: asReminders(row.reminders),
    notes: asString(row.notes),
    sourceText: asString(row.sourceText),
    thumbnail: asThumbnail(row.thumbnail),
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    history: Array.isArray(row.history) ? row.history.map(sanitizeRevision) : [],
  };
}

function sanitizePerson(raw: unknown): Person {
  if (!raw || typeof raw !== 'object') throw new Error('bad-backup');
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.name.trim()) throw new Error('bad-backup');
  return { id: row.id, name: row.name.trim(), createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0 };
}

export function serializeBackup(people: Person[], items: Item[], now = new Date()): string {
  const file: BackupFile = {
    app: 'bie-wang-le',
    version: 2,
    exportedAt: now.toISOString(),
    people,
    items,
  };
  return JSON.stringify(file, null, 2);
}

export function parseBackup(text: string): { people: Person[]; items: Item[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('bad-backup');
  }
  if (!data || typeof data !== 'object') throw new Error('bad-backup');
  const file = data as Record<string, unknown>;
  const known = (file.app === 'expiry-butler' && file.version === 1) || (file.app === 'bie-wang-le' && (file.version === 1 || file.version === 2));
  if (!known) throw new Error('bad-backup');
  if (!Array.isArray(file.people) || !Array.isArray(file.items)) throw new Error('bad-backup');
  return {
    people: file.people.map(sanitizePerson),
    items: file.items.map(sanitizeItem),
  };
}
