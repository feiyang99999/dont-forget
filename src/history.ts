import type { Cycle, Item, Revision } from './types.ts';

export interface NextFields {
  name: string;
  category: Item['category'];
  personId: string;
  amount: number | null;
  currency: string | null;
  validFrom: string | null;
  validUntil: string;
  cycle: Cycle | null;
  reminders: number[];
  notes: string;
  sourceText: string;
  thumbnail: string | null;
}

export interface TimelineEntry {
  label: 'current' | 'superseded';
  name: string;
  validFrom: string | null;
  validUntil: string;
  amount: number | null;
  currency: string | null;
  sourceText: string;
  thumbnail: string | null;
  notes: string;
  at: number;
}

/** Close the current fact and open the next one. The old verbatim text stays in history. */
export function supersedeItem(item: Item, next: NextFields, at: number, revisionId: string): Item {
  const revision: Revision = {
    id: revisionId,
    name: item.name,
    category: item.category,
    personId: item.personId,
    amount: item.amount,
    currency: item.currency,
    validFrom: item.validFrom,
    validUntil: item.validUntil,
    cycle: item.cycle,
    reminders: [...item.reminders],
    notes: item.notes,
    sourceText: item.sourceText,
    thumbnail: item.thumbnail,
    recordedAt: item.updatedAt,
    supersededAt: at,
  };
  return {
    ...item,
    ...next,
    reminders: [...next.reminders],
    updatedAt: at,
    history: [revision, ...item.history],
  };
}

export function timelineOf(item: Item): TimelineEntry[] {
  const current: TimelineEntry = {
    label: 'current',
    name: item.name,
    validFrom: item.validFrom,
    validUntil: item.validUntil,
    amount: item.amount,
    currency: item.currency,
    sourceText: item.sourceText,
    thumbnail: item.thumbnail,
    notes: item.notes,
    at: item.updatedAt,
  };
  const older = item.history.map((revision) => ({
    label: 'superseded' as const,
    name: revision.name,
    validFrom: revision.validFrom,
    validUntil: revision.validUntil,
    amount: revision.amount,
    currency: revision.currency,
    sourceText: revision.sourceText,
    thumbnail: revision.thumbnail,
    notes: revision.notes,
    at: revision.supersededAt,
  }));
  return [current, ...older];
}
