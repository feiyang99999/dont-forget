import type { Category, Item, ItemKind } from './types.ts';

export interface SearchHit {
  item: Item;
  historyMatch: boolean;
}

function currentBlob(item: Item): string {
  return [item.name, item.notes, item.sourceText, item.currency ?? '', item.amount ?? '', item.validFrom ?? '', item.validUntil]
    .join('\n')
    .toLowerCase();
}

function historyBlob(item: Item): string {
  return item.history
    .map((revision) => [revision.name, revision.notes, revision.sourceText, revision.validUntil, revision.amount ?? ''].join('\n'))
    .join('\n')
    .toLowerCase();
}

/**
 * Literal full-text scan over fields, verbatim OCR, and superseded revisions.
 * Person and category narrow the scan the way a wing and room would.
 * This is not semantic / vector search.
 */
export function searchItems(items: Item[], options: {
  query: string;
  personId: string;
  category: Category | 'all';
  kind?: ItemKind | 'all';
}): SearchHit[] {
  const query = options.query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  for (const item of items) {
    if (options.kind && options.kind !== 'all' && item.kind !== options.kind) continue;
    if (options.personId !== 'all' && item.personId !== options.personId) continue;
    if (options.category !== 'all' && item.category !== options.category) continue;
    if (!query) {
      hits.push({ item, historyMatch: false });
      continue;
    }
    const inCurrent = currentBlob(item).includes(query);
    const inHistory = historyBlob(item).includes(query);
    if (inCurrent || inHistory) hits.push({ item, historyMatch: inHistory && !inCurrent });
  }
  return hits;
}
