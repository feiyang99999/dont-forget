import { asset } from './assets.ts';
import { parseBackup, serializeBackup } from './backup.ts';
import { nextOccurrence, normalizeReminders, parseAmount, todayIso } from './dates.ts';
import { clearAll, deleteItem, getMeta, loadAll, replaceAll, saveItem, savePeople, setMeta } from './db.ts';
import { downloadText } from './download.ts';
import { extractDocument } from './extract.ts';
import { supersedeItem, type NextFields } from './history.ts';
import { categoryLabel, fill, ocrPhase, t } from './i18n.ts';
import { buildIcs, type IcsEvent } from './ics.ts';
import { canvasThumb, fileToCanvas } from './image.ts';
import { formatMoney } from './money.ts';
import { recognize } from './ocr.ts';
import { personName } from './people.ts';
import { renderApp } from './render.ts';
import type { Category, Draft, Item, ItemKind, Lang, ViewState } from './types.ts';
import { CATEGORIES } from './types.ts';

const state: ViewState = {
  lang: 'zh',
  view: 'list',
  loaded: false,
  dbError: '',
  items: [],
  people: [],
  query: '',
  personFilter: 'all',
  categoryFilter: 'all',
  draft: null,
  ocr: { running: false, progress: 0, status: '', error: '' },
  pendingDelete: null,
  toast: '',
  confirmClear: false,
};

let ocrToken = 0;
let bound = false;

function storedLang(): Lang {
  const saved = localStorage.getItem('expiry-butler-lang');
  return saved === 'en' ? 'en' : 'zh';
}

function applyLang(lang: Lang): void {
  state.lang = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = lang === 'zh' ? '到期管家' : 'Expiry Butler';
  localStorage.setItem('expiry-butler-lang', lang);
}

function render(): void {
  const root = document.querySelector('#app');
  if (!root) return;
  const active = document.activeElement;
  const searchFocused = active instanceof HTMLInputElement && active.id === 'q';
  const caret = searchFocused ? active.selectionStart : null;
  root.innerHTML = renderApp(state);
  if (searchFocused) {
    const next = document.querySelector<HTMLInputElement>('#q');
    next?.focus();
    if (next && caret != null) next.setSelectionRange(caret, caret);
  }
}

function showToast(message: string): void {
  state.toast = message;
  const existing = document.querySelector('#toast');
  if (!existing) render();
  const toast = document.querySelector<HTMLElement>('#toast');
  if (toast) {
    toast.hidden = false;
    toast.textContent = message;
  }
  window.setTimeout(() => {
    if (state.toast !== message) return;
    state.toast = '';
    const node = document.querySelector<HTMLElement>('#toast');
    if (node) node.hidden = true;
  }, 2800);
}

function blankDraft(kind: ItemKind): Draft {
  const personId = state.personFilter !== 'all' ? state.personFilter : (state.people[0]?.id ?? 'person-me');
  return {
    id: null,
    kind,
    mode: 'create',
    name: '',
    category: kind === 'subscription' ? 'subscription' : 'other',
    personId,
    amount: '',
    currency: 'CNY',
    validFrom: '',
    validUntil: '',
    cycle: 'monthly',
    reminders: [30, 7, 1],
    notes: '',
    sourceText: '',
    thumbnail: null,
    error: '',
  };
}

function draftFrom(item: Item, mode: Draft['mode']): Draft {
  return {
    id: item.id,
    kind: item.kind,
    mode,
    name: item.name,
    category: item.category,
    personId: item.personId,
    amount: item.amount == null ? '' : String(item.amount),
    currency: item.currency ?? 'CNY',
    validFrom: item.validFrom ?? '',
    validUntil: item.validUntil,
    cycle: item.cycle ?? 'monthly',
    reminders: [...item.reminders],
    notes: item.notes,
    sourceText: item.sourceText,
    thumbnail: item.thumbnail,
    error: '',
  };
}

function scrapeForm(): void {
  const form = document.querySelector<HTMLFormElement>('#editor');
  const draft = state.draft;
  if (!form || !draft) return;
  const data = new FormData(form);
  draft.name = String(data.get('name') ?? '');
  draft.personId = String(data.get('personId') ?? draft.personId);
  const category = String(data.get('category') ?? draft.category);
  if (CATEGORIES.includes(category as Category)) draft.category = category as Category;
  draft.amount = String(data.get('amount') ?? '');
  draft.currency = String(data.get('currency') ?? 'CNY');
  draft.validFrom = String(data.get('validFrom') ?? '');
  draft.validUntil = String(data.get('validUntil') ?? '');
  draft.notes = String(data.get('notes') ?? '');
  draft.sourceText = String(data.get('sourceText') ?? '');
  if (draft.kind === 'subscription') {
    draft.cycle = String(data.get('cycle') ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly';
    draft.category = 'subscription';
  }
  draft.reminders = normalizeReminders(data.getAll('reminder').map((value) => Number(value)));
}

function scrapePeople(): void {
  document.querySelectorAll<HTMLInputElement>('.person-name').forEach((input) => {
    const person = state.people.find((entry) => entry.id === input.dataset.personId);
    const name = input.value.trim();
    if (person && name) person.name = name;
  });
}

function applyGuesses(draft: Draft): void {
  const extracted = extractDocument(draft.sourceText);
  if (extracted.title) draft.name = extracted.title;
  if (draft.kind !== 'subscription' && extracted.category !== 'other') draft.category = extracted.category;
  if (extracted.amount != null) draft.amount = String(extracted.amount);
  if (extracted.currency) draft.currency = extracted.currency;
  if (extracted.validFrom) draft.validFrom = extracted.validFrom;
  if (extracted.validUntil) draft.validUntil = extracted.validUntil;
  draft.error = extracted.validUntil ? '' : t(state.lang, 'extractNone');
}

function updateOcrDom(): void {
  const bar = document.querySelector<HTMLElement>('#ocr-bar');
  const label = document.querySelector('#ocr-label');
  if (!bar || !label) {
    render();
    return;
  }
  const progress = Math.max(0, Math.min(100, Math.round(state.ocr.progress * 100)));
  bar.style.width = `${progress}%`;
  label.textContent = `${ocrPhase(state.lang, state.ocr.status)} ${progress}%`;
}

async function runOcr(blob: Blob): Promise<void> {
  const token = ++ocrToken;
  state.ocr = { running: true, progress: 0, status: 'loading tesseract core', error: '' };
  state.view = 'capture';
  if (!state.draft) state.draft = blankDraft('expiry');
  render();
  try {
    const canvas = await fileToCanvas(blob, 1600);
    if (token !== ocrToken) return;
    const thumb = canvasThumb(canvas);
    const text = await recognize(canvas, (message) => {
      if (token !== ocrToken) return;
      state.ocr.status = message.status;
      state.ocr.progress = message.progress;
      updateOcrDom();
    });
    if (token !== ocrToken || !state.draft) return;
    state.draft.thumbnail = thumb;
    state.draft.sourceText = text;
    if (state.draft.id && state.draft.mode === 'edit') state.draft.mode = 'renew';
    applyGuesses(state.draft);
    state.view = 'edit';
  } catch (error) {
    if (token !== ocrToken) return;
    const message = error instanceof Error ? error.message : String(error);
    state.ocr.error = /fetch|network|failed to load/i.test(message) ? message : message;
    state.view = 'capture';
  } finally {
    if (token === ocrToken) {
      state.ocr.running = false;
      render();
    }
  }
}

function fieldsFromDraft(draft: Draft): NextFields {
  const amount = parseAmount(draft.amount);
  return {
    name: draft.name.trim(),
    category: draft.kind === 'subscription' ? 'subscription' : draft.category,
    personId: draft.personId,
    amount,
    currency: amount == null ? null : draft.currency,
    validFrom: draft.validFrom || null,
    validUntil: draft.validUntil,
    cycle: draft.kind === 'subscription' ? draft.cycle : null,
    reminders: normalizeReminders(draft.reminders),
    notes: draft.notes.trim(),
    sourceText: draft.sourceText,
    thumbnail: draft.thumbnail,
  };
}

async function saveDraft(): Promise<void> {
  scrapeForm();
  const draft = state.draft;
  if (!draft) return;
  if (!draft.name.trim()) {
    draft.error = t(state.lang, 'needName');
    render();
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.validUntil)) {
    draft.error = t(state.lang, 'needDate');
    render();
    return;
  }
  if (draft.validFrom && draft.validFrom > draft.validUntil) {
    draft.error = t(state.lang, 'dateOrder');
    render();
    return;
  }
  if (draft.amount.trim() && parseAmount(draft.amount) == null) {
    draft.error = t(state.lang, 'badAmount');
    render();
    return;
  }
  const now = Date.now();
  const next = fieldsFromDraft(draft);
  let item: Item;
  const mode = draft.mode;
  if (!draft.id) {
    item = { id: crypto.randomUUID(), kind: draft.kind, createdAt: now, updatedAt: now, history: [], ...next };
  } else {
    const existing = state.items.find((entry) => entry.id === draft.id);
    if (!existing) return;
    item = mode === 'renew'
      ? supersedeItem(existing, next, now, crypto.randomUUID())
      : { ...existing, ...next, updatedAt: now };
  }
  if (item.kind === 'subscription' && item.cycle && item.validUntil < todayIso()) {
    item.validUntil = nextOccurrence(item.validUntil, item.cycle, todayIso());
  }
  try {
    await saveItem(item);
  } catch (error) {
    draft.error = error instanceof Error ? error.message : t(state.lang, 'dbError');
    render();
    return;
  }
  const index = state.items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) state.items[index] = item;
  else state.items.push(item);
  state.draft = null;
  state.view = item.kind === 'subscription' ? 'subs' : 'list';
  showToast(t(state.lang, mode === 'renew' ? 'renewed' : 'saved'));
  render();
}

function describe(item: Item): string {
  const lines = [
    personName(state.people, item.personId),
    categoryLabel(state.lang, item.category),
    item.validFrom ? `${t(state.lang, 'fieldFrom')} ${item.validFrom}` : '',
    `${item.kind === 'subscription' ? t(state.lang, 'fieldCharge') : t(state.lang, 'fieldUntil')} ${item.validUntil}`,
    item.amount != null ? formatMoney(item.amount, item.currency || 'CNY', state.lang) : '',
    t(state.lang, 'icsNote'),
  ];
  return lines.filter(Boolean).join('\n');
}

function toEvent(item: Item): IcsEvent {
  const who = personName(state.people, item.personId);
  const prefix = item.kind === 'subscription' ? t(state.lang, 'chargeWord') : t(state.lang, 'expiryWord');
  return {
    uid: `${item.id}@expiry-butler.local`,
    title: `${prefix}: ${who} ${item.name}`.replace(/\s+/g, ' ').trim(),
    description: describe(item),
    date: item.validUntil,
    alarms: item.reminders,
  };
}

function exportIcs(items: Item[]): void {
  if (!items.length) return;
  downloadText('expiry-butler.ics', buildIcs(items.map(toEvent)), 'text/calendar;charset=utf-8');
  showToast(t(state.lang, 'exportedIcs'));
}

async function rollSubscriptions(): Promise<void> {
  const today = todayIso();
  for (const item of state.items) {
    if (item.kind !== 'subscription' || !item.cycle || item.validUntil >= today) continue;
    const next = nextOccurrence(item.validUntil, item.cycle, today);
    if (next === item.validUntil) continue;
    item.validUntil = next;
    item.updatedAt = Date.now();
    await saveItem(item);
  }
}

function dirty(): boolean {
  return state.view === 'edit' || state.view === 'capture';
}

async function onClick(event: MouseEvent): Promise<void> {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
  if (!target) return;
  const action = target.dataset.action ?? '';
  if (document.querySelector('#editor')) scrapeForm();
  if (document.querySelector('.person-name')) scrapePeople();
  if (state.ocr.running && action !== 'cancel-ocr') return;
  if (action !== 'delete' && action !== 'clear') state.pendingDelete = null;
  if (action !== 'clear') state.confirmClear = false;

  if (action === 'lang') {
    scrapeForm();
    scrapePeople();
    applyLang(state.lang === 'zh' ? 'en' : 'zh');
    await setMeta('lang', state.lang).catch(() => undefined);
    render();
    return;
  }
  if (action === 'nav') {
    const view = target.dataset.view;
    if (view !== 'list' && view !== 'subs' && view !== 'settings') return;
    if (dirty() && !window.confirm(t(state.lang, 'discard'))) return;
    state.draft = null;
    state.view = view;
    render();
    return;
  }
  if (action === 'back') {
    if (dirty() && (state.draft?.name || state.draft?.sourceText) && !window.confirm(t(state.lang, 'discard'))) return;
    state.draft = null;
    state.view = 'list';
    render();
    return;
  }
  if (action === 'capture') {
    state.draft = null;
    state.ocr.error = '';
    state.view = 'capture';
    render();
    return;
  }
  if (action === 'pick-camera') {
    document.querySelector<HTMLInputElement>('#camera')?.click();
    return;
  }
  if (action === 'pick-album' || action === 'replace-photo') {
    if (action === 'replace-photo') scrapeForm();
    document.querySelector<HTMLInputElement>(action === 'replace-photo' ? '#replace-photo' : '#album')?.click();
    return;
  }
  if (action === 'use-sample') {
    if (!state.draft) state.draft = blankDraft('expiry');
    const response = await fetch(asset('sample-policy.png'));
    if (!response.ok) {
      state.ocr.error = `${response.status}`;
      render();
      return;
    }
    await runOcr(await response.blob());
    return;
  }
  if (action === 'manual') {
    const kind: ItemKind = target.dataset.kind === 'subscription' ? 'subscription' : 'expiry';
    state.draft = blankDraft(kind);
    state.view = 'edit';
    render();
    return;
  }
  if (action === 'cancel-ocr') {
    ocrToken += 1;
    state.ocr.running = false;
    state.view = 'capture';
    render();
    return;
  }
  if (action === 'person') {
    state.personFilter = target.dataset.id || 'all';
    render();
    return;
  }
  if (action === 'category') {
    const category = target.dataset.id || 'all';
    state.categoryFilter = category === 'all' || CATEGORIES.includes(category as Category) ? category as Category | 'all' : 'all';
    render();
    return;
  }
  if (action === 'open' || action === 'renew') {
    const item = state.items.find((entry) => entry.id === target.dataset.id);
    if (!item) return;
    state.draft = draftFrom(item, action === 'renew' ? 'renew' : 'edit');
    state.view = 'edit';
    render();
    return;
  }
  if (action === 'ics') {
    const item = state.items.find((entry) => entry.id === target.dataset.id);
    if (item) exportIcs([item]);
    return;
  }
  if (action === 'delete') {
    const id = target.dataset.id;
    if (!id) return;
    if (state.pendingDelete !== id) {
      state.pendingDelete = id;
      render();
      return;
    }
    await deleteItem(id);
    state.items = state.items.filter((item) => item.id !== id);
    state.pendingDelete = null;
    if (state.draft?.id === id) {
      state.draft = null;
      state.view = 'list';
    }
    showToast(t(state.lang, 'deleted'));
    render();
    return;
  }
  if (action === 'reextract') {
    scrapeForm();
    if (state.draft) applyGuesses(state.draft);
    render();
    return;
  }
  if (action === 'add-reminder') {
    scrapeForm();
    const raw = document.querySelector<HTMLInputElement>('#custom-days')?.value ?? '';
    const days = Number(raw);
    if (state.draft && raw.trim() && Number.isInteger(days)) state.draft.reminders = normalizeReminders([...state.draft.reminders, days]);
    render();
    return;
  }
  if (action === 'add-person') {
    scrapePeople();
    state.people.push({ id: crypto.randomUUID(), name: t(state.lang, 'newPerson'), createdAt: Date.now() });
    await savePeople(state.people);
    render();
    return;
  }
  if (action === 'save-people') {
    scrapePeople();
    await savePeople(state.people);
    showToast(t(state.lang, 'peopleSaved'));
    render();
    return;
  }
  if (action === 'delete-person') {
    scrapePeople();
    const id = target.dataset.id;
    if (!id) return;
    if (state.people.length <= 1) {
      showToast(t(state.lang, 'peopleLast'));
      return;
    }
    const used = state.items.some((item) => item.personId === id || item.history.some((revision) => revision.personId === id));
    if (used) {
      showToast(t(state.lang, 'peopleInUse'));
      return;
    }
    state.people = state.people.filter((person) => person.id !== id);
    await savePeople(state.people);
    if (state.personFilter === id) state.personFilter = 'all';
    render();
    return;
  }
  if (action === 'export-json') {
    downloadText('expiry-butler-backup.json', serializeBackup(state.people, state.items), 'application/json');
    showToast(t(state.lang, 'exportedJson'));
    return;
  }
  if (action === 'pick-backup') {
    document.querySelector<HTMLInputElement>('#backup-file')?.click();
    return;
  }
  if (action === 'export-all-ics') {
    exportIcs(state.items);
    return;
  }
  if (action === 'clear') {
    if (!state.confirmClear) {
      state.confirmClear = true;
      render();
      return;
    }
    await clearAll();
    const loaded = await loadAll();
    state.people = loaded.people;
    state.items = [];
    state.confirmClear = false;
    state.draft = null;
    showToast(t(state.lang, 'cleared'));
    render();
  }
}

async function onChange(event: Event): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.files?.[0]) return;
  const file = target.files[0];
  target.value = '';
  if (target.id === 'backup-file') {
    try {
      const parsed = parseBackup(await file.text());
      const replace = document.querySelector<HTMLInputElement>('#replace-backup')?.checked ?? false;
      if (replace) {
        await replaceAll(parsed.people, parsed.items);
        state.people = parsed.people;
        state.items = parsed.items;
      } else {
        const people = [...state.people];
        for (const person of parsed.people) {
          const index = people.findIndex((entry) => entry.id === person.id);
          if (index >= 0) people[index] = person;
          else people.push(person);
        }
        const items = new Map(state.items.map((item) => [item.id, item]));
        for (const item of parsed.items) items.set(item.id, item);
        await savePeople(people);
        for (const item of parsed.items) await saveItem(item);
        state.people = people;
        state.items = [...items.values()];
      }
      await rollSubscriptions();
      showToast(fill(t(state.lang, 'imported'), { n: parsed.items.length }));
      render();
    } catch {
      showToast(t(state.lang, 'importFail'));
    }
    return;
  }
  if (target.type === 'file') {
    if (!state.draft) state.draft = blankDraft('expiry');
    await runOcr(file);
  }
}

function onInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.id !== 'q') return;
  state.query = target.value;
  render();
}

function onSubmit(event: SubmitEvent): void {
  if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'editor') return;
  event.preventDefault();
  void saveDraft();
}

async function boot(): Promise<void> {
  applyLang(storedLang());
  if (!bound) {
    document.addEventListener('click', (event) => { void onClick(event); });
    document.addEventListener('change', (event) => { void onChange(event); });
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit);
    bound = true;
  }
  render();
  try {
    const loaded = await loadAll();
    state.people = loaded.people;
    state.items = loaded.items;
    const lang = await getMeta('lang');
    if (lang === 'zh' || lang === 'en') applyLang(lang);
    await rollSubscriptions();
  } catch {
    state.dbError = t(state.lang, 'dbError');
  }
  state.loaded = true;
  render();
}

export { boot };
