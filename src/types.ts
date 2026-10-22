export type Lang = 'zh' | 'en';

export type Category = 'document' | 'car' | 'house' | 'money' | 'insurance' | 'health' | 'subscription' | 'household' | 'child';

export type Cycle = 'monthly' | 'yearly';

export type ItemKind = 'expiry' | 'subscription';

export interface Revision {
  id: string;
  name: string;
  category: Category;
  personId: string;
  amount: number | null;
  currency: string | null;
  validFrom: string | null;
  validUntil: string;
  cycle: Cycle | null;
  dueDay: number | null;
  dueMonth: number | null;
  seriesUntil: string | null;
  seriesCount: number | null;
  reminders: number[];
  notes: string;
  sourceText: string;
  thumbnail: string | null;
  recordedAt: number;
  supersededAt: number;
}

/** One drawer: current fields plus verbatim text, thumbnail, and superseded revisions. */
export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  category: Category;
  personId: string;
  amount: number | null;
  currency: string | null;
  validFrom: string | null;
  validUntil: string;
  cycle: Cycle | null;
  dueDay: number | null;
  dueMonth: number | null;
  seriesUntil: string | null;
  seriesCount: number | null;
  reminders: number[];
  notes: string;
  sourceText: string;
  thumbnail: string | null;
  createdAt: number;
  updatedAt: number;
  history: Revision[];
}

/** A wing: a person the documents belong to. */
export interface Person {
  id: string;
  name: string;
  createdAt: number;
}

export interface Extraction {
  title: string;
  category: Category;
  amount: number | null;
  currency: string | null;
  validFrom: string | null;
  validUntil: string | null;
}

export interface Draft {
  id: string | null;
  kind: ItemKind;
  mode: 'create' | 'edit' | 'renew';
  name: string;
  category: Category;
  personId: string;
  amount: string;
  currency: string;
  validFrom: string;
  validUntil: string;
  cycle: Cycle | null;
  dueDay: string;
  dueMonth: string;
  seriesUntil: string;
  seriesCount: string;
  reminders: number[];
  notes: string;
  sourceText: string;
  thumbnail: string | null;
  error: string;
}

export interface ViewState {
  lang: Lang;
  view: 'list' | 'subs' | 'settings' | 'edit' | 'capture' | 'templates';
  loaded: boolean;
  dbError: string;
  items: Item[];
  people: Person[];
  query: string;
  personFilter: string;
  categoryFilter: Category | 'all';
  draft: Draft | null;
  ocr: { running: boolean; progress: number; status: string; error: string };
  pendingDelete: string | null;
  toast: string;
  confirmClear: boolean;
}
