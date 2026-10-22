import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item, Person } from './types.ts';
import { defaultPeople } from './people.ts';

const DB_NAME = 'expiry-butler';
const DB_VERSION = 1;

interface MetaRow {
  key: string;
  value: string;
}

interface ButlerDB extends DBSchema {
  items: { key: string; value: Item };
  people: { key: string; value: Person };
  meta: { key: string; value: MetaRow };
}

let opening: Promise<IDBPDatabase<ButlerDB>> | null = null;

function openDb(): Promise<IDBPDatabase<ButlerDB>> {
  if (!opening) {
    opening = openDB<ButlerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('people')) db.createObjectStore('people', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      },
      blocking() {
        void opening?.then((db) => db.close()).catch(() => undefined);
        opening = null;
      },
      terminated() {
        opening = null;
      },
    }).catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

export async function deleteDatabase(): Promise<void> {
  if (opening) {
    try {
      const db = await opening;
      db.close();
    } catch {
      /* already failing */
    }
    opening = null;
  }
  await deleteDB(DB_NAME);
}

function orderPeople(people: Person[], order: string): Person[] {
  const rank = new Map(order.split(',').filter(Boolean).map((id, index) => [id, index]));
  return [...people].sort((a, b) => {
    const left = rank.get(a.id);
    const right = rank.get(b.id);
    if (left != null && right != null && left !== right) return left - right;
    if (left != null && right == null) return -1;
    if (left == null && right != null) return 1;
    return a.createdAt - b.createdAt || a.name.localeCompare(b.name, 'zh');
  });
}

export async function loadAll(): Promise<{ people: Person[]; items: Item[] }> {
  const db = await openDb();
  const tx = db.transaction(['people', 'items', 'meta'], 'readonly');
  const peopleRequest = tx.objectStore('people').getAll();
  const itemsRequest = tx.objectStore('items').getAll();
  const orderRequest = tx.objectStore('meta').get('peopleOrder');
  const [people, items, orderRow] = await Promise.all([peopleRequest, itemsRequest, orderRequest]);
  await tx.done;
  if (people.length > 0) return { people: orderPeople(people, orderRow?.value ?? ''), items };
  const seeded = defaultPeople();
  await savePeople(seeded);
  return { people: seeded, items };
}

export async function saveItem(item: Item): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').put(item);
  await tx.done;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').delete(id);
  await tx.done;
}

export async function savePeople(people: Person[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['people', 'meta'], 'readwrite');
  const store = tx.objectStore('people');
  store.clear();
  for (const person of people) store.put(person);
  tx.objectStore('meta').put({ key: 'peopleOrder', value: people.map((person) => person.id).join(',') });
  await tx.done;
}

export async function replaceAll(people: Person[], items: Item[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['people', 'items', 'meta'], 'readwrite');
  const peopleStore = tx.objectStore('people');
  const itemStore = tx.objectStore('items');
  peopleStore.clear();
  itemStore.clear();
  for (const person of people) peopleStore.put(person);
  for (const item of items) itemStore.put(item);
  tx.objectStore('meta').put({ key: 'peopleOrder', value: people.map((person) => person.id).join(',') });
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['people', 'items', 'meta'], 'readwrite');
  tx.objectStore('people').clear();
  tx.objectStore('items').clear();
  tx.objectStore('meta').clear();
  await tx.done;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await openDb();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDb();
  await db.put('meta', { key, value });
}
