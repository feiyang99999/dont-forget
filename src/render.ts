import { daysUntil, urgency } from './dates.ts';
import { esc, paragraphs } from './dom.ts';
import { categoryLabel, daysText, fill, ocrPhase, t } from './i18n.ts';
import { formatMoney, monthlyAmount } from './money.ts';
import { personName } from './people.ts';
import { searchItems, type SearchHit } from './search.ts';
import { timelineOf } from './history.ts';
import type { Category, Draft, Item, Person, ViewState } from './types.ts';
import { CATEGORIES, TEMPLATES } from './templates.ts';

const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY'];

function chips(state: ViewState, includeCategory: boolean): string {
  const people = [
    `<button type="button" class="chip" data-action="person" data-id="all" aria-pressed="${state.personFilter === 'all'}">${esc(t(state.lang, 'filterAll'))}</button>`,
    ...state.people.map((person) => `<button type="button" class="chip" data-action="person" data-id="${esc(person.id)}" aria-pressed="${state.personFilter === person.id}">${esc(person.name)}</button>`),
  ].join('');
  const categories = includeCategory
    ? `<div class="chips" role="group">${['all', ...CATEGORIES].map((category) => {
      const label = category === 'all' ? t(state.lang, 'filterAll') : categoryLabel(state.lang, category as Category);
      return `<button type="button" class="chip" data-action="category" data-id="${category}" aria-pressed="${state.categoryFilter === category}">${esc(label)}</button>`;
    }).join('')}</div>`
    : '';
  return `<div class="chips" role="group">${people}</div>${categories}<p class="hint">${esc(t(state.lang, 'scopeHint'))}</p>`;
}

function banner(state: ViewState): string {
  const soon = state.items.filter((item) => daysUntil(item.validUntil) <= 7).length;
  if (!soon) return '';
  return `<p class="banner" role="status">${esc(fill(t(state.lang, 'dueBanner'), { n: soon }))}</p>`;
}

function card(state: ViewState, hit: SearchHit): string {
  const item = hit.item;
  const level = urgency(item.validUntil);
  const days = daysText(state.lang, daysUntil(item.validUntil));
  const thumb = item.thumbnail ? `<img class="thumb" alt="" src="${esc(item.thumbnail)}">` : '';
  const schedule = item.seriesCount === 0
    ? `<p class="flag">${esc(t(state.lang, 'ended'))}</p>`
    : item.cycle === 'monthly' && item.dueDay
      ? `<p class="flag">${esc(fill(t(state.lang, 'monthlyOn'), { day: item.dueDay }))}</p>`
      : item.cycle === 'yearly' && item.dueMonth && item.dueDay
        ? `<p class="flag">${esc(fill(t(state.lang, 'yearlyOn'), { month: item.dueMonth, day: item.dueDay }))}</p>`
        : '';
  const money = item.amount == null
    ? ''
    : `<p class="money">${esc(formatMoney(item.amount, item.currency || 'CNY', state.lang))}${item.kind === 'subscription' ? ` ${esc(item.cycle === 'yearly' ? t(state.lang, 'perYear') : t(state.lang, 'perMonth'))}` : ''}</p>`;
  const monthly = monthlyAmount(item);
  const share = item.kind === 'subscription' && item.cycle === 'yearly' && monthly != null
    ? `<p class="hint">${esc(t(state.lang, 'yearlyNote'))} · ${esc(formatMoney(monthly, item.currency || 'CNY', state.lang))} ${esc(t(state.lang, 'perMonth'))}</p>`
    : '';
  const flags = [
    hit.historyMatch ? `<p class="flag">${esc(t(state.lang, 'historyMatch'))}</p>` : '',
    item.history.length ? `<p class="flag">${esc(fill(t(state.lang, 'historyCount'), { n: item.history.length }))}</p>` : '',
  ].join('');
  const deleting = state.pendingDelete === item.id;
  return `<article class="card ${level}">
    <div class="card-main">${thumb}<div>
      <h3>${esc(item.name)}</h3>
      <p class="meta">${esc(personName(state.people, item.personId) || t(state.lang, 'unknownPerson'))} · ${esc(categoryLabel(state.lang, item.category))}</p>
      <p class="when"><time datetime="${esc(item.validUntil)}">${esc(item.validUntil)}</time> · ${esc(days)}</p>
      ${money}${share}${schedule}${flags}
    </div></div>
    <div class="actions">
      <button type="button" data-action="open" data-id="${esc(item.id)}" aria-label="${esc(`${t(state.lang, 'edit')} ${item.name}`)}">${esc(t(state.lang, 'edit'))}</button>
      <button type="button" data-action="renew" data-id="${esc(item.id)}" aria-label="${esc(`${t(state.lang, 'renew')} ${item.name}`)}">${esc(t(state.lang, 'renew'))}</button>
      <button type="button" data-action="ics" data-id="${esc(item.id)}" aria-label="${esc(`${t(state.lang, 'addCalendar')} ${item.name}`)}">${esc(t(state.lang, 'addCalendar'))}</button>
      <button type="button" class="danger" data-action="delete" data-id="${esc(item.id)}" aria-label="${esc(`${deleting ? t(state.lang, 'confirmDelete') : t(state.lang, 'remove')} ${item.name}`)}">${esc(deleting ? t(state.lang, 'confirmDelete') : t(state.lang, 'remove'))}</button>
    </div>
  </article>`;
}

function grouped(state: ViewState, hits: SearchHit[]): string {
  const buckets = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const list = buckets.get(hit.item.personId) ?? [];
    list.push(hit);
    buckets.set(hit.item.personId, list);
  }
  const sections: string[] = [];
  const emit = (person: Person, list: SearchHit[]) => {
    sections.push(`<section><h2>${esc(person.name)}</h2>${list.map((hit) => card(state, hit)).join('')}</section>`);
  };
  for (const person of state.people) {
    const list = buckets.get(person.id);
    if (list?.length) emit(person, list);
    buckets.delete(person.id);
  }
  for (const [id, list] of buckets) emit({ id, name: t(state.lang, 'unknownPerson'), createdAt: 0 }, list);
  return sections.join('') || `<div class="empty"><h2>${esc(t(state.lang, 'emptyTitle'))}</h2><p>${esc(t(state.lang, 'emptyBody'))}</p></div>`;
}

function listView(state: ViewState): string {
  const sorted = [...state.items].sort((a, b) => a.validUntil.localeCompare(b.validUntil) || a.name.localeCompare(b.name, state.lang === 'zh' ? 'zh' : 'en'));
  const hits = searchItems(sorted, {
    query: state.query,
    personId: state.personFilter,
    category: state.categoryFilter,
    kind: 'expiry',
  });
  const hasAny = state.items.some((item) => item.kind === 'expiry');
  const emptyTitle = hasAny ? t(state.lang, 'noMatchTitle') : t(state.lang, 'emptyTitle');
  const emptyBody = hasAny ? t(state.lang, 'noMatchBody') : t(state.lang, 'emptyBody');
  const body = !state.loaded
    ? `<p class="hint">${esc(t(state.lang, 'loading'))}</p>`
    : hits.length
      ? grouped(state, hits)
      : `<div class="empty"><h2>${esc(emptyTitle)}</h2><p>${esc(emptyBody)}</p></div>`;
  return `${banner(state)}
    <div class="actions stack">
      <button type="button" class="primary" data-action="capture">${esc(t(state.lang, 'addPhoto'))}</button>
      <button type="button" data-action="templates">${esc(t(state.lang, 'addTemplate'))}</button>
      <button type="button" data-action="manual" data-kind="expiry">${esc(t(state.lang, 'addManual'))}</button>
    </div>
    <label class="search"><span class="sr">${esc(t(state.lang, 'searchPlaceholder'))}</span>
      <input id="q" type="search" enterkeyhint="search" placeholder="${esc(t(state.lang, 'searchPlaceholder'))}" value="${esc(state.query)}">
    </label>
    ${chips(state, true)}
    <div id="list-body">${body}</div>`;
}

function subsView(state: ViewState): string {
  const sorted = [...state.items].sort((a, b) => a.validUntil.localeCompare(b.validUntil));
  const hits = searchItems(sorted, {
    query: state.query,
    personId: state.personFilter,
    category: 'all',
    kind: 'subscription',
  });
  const totals = new Map<string, number>();
  for (const hit of hits) {
    const monthly = monthlyAmount(hit.item);
    if (monthly == null) continue;
    const currency = hit.item.currency || 'CNY';
    totals.set(currency, (totals.get(currency) ?? 0) + monthly);
  }
  const totalHtml = [...totals.entries()].map(([currency, monthly]) => `<strong>${esc(formatMoney(monthly, currency, state.lang))}</strong>`).join('');
  const hasAny = state.items.some((item) => item.kind === 'subscription');
  const body = hits.length
    ? grouped(state, hits)
    : `<div class="empty"><h2>${esc(t(state.lang, hasAny ? 'noMatchTitle' : 'subsEmptyTitle'))}</h2><p>${esc(t(state.lang, hasAny ? 'noMatchBody' : 'subsEmptyBody'))}</p></div>`;
  return `${banner(state)}
    <section class="total"><p>${esc(t(state.lang, 'monthlyTotal'))}</p><div class="total-figures">${totalHtml || `<span>${esc(t(state.lang, 'noMoney'))}</span>`}</div><p class="hint">${esc(t(state.lang, 'yearlyNote'))}</p></section>
    <div class="actions stack">
      <button type="button" class="primary" data-action="manual" data-kind="subscription">${esc(t(state.lang, 'addSub'))}</button>
    </div>
    <label class="search"><span class="sr">${esc(t(state.lang, 'searchPlaceholder'))}</span>
      <input id="q" type="search" placeholder="${esc(t(state.lang, 'searchPlaceholder'))}" value="${esc(state.query)}">
    </label>
    ${chips(state, false)}
    ${state.loaded ? body : `<p class="hint">${esc(t(state.lang, 'loading'))}</p>`}`;
}

function options(values: { value: string; label: string }[], current: string): string {
  return values.map((entry) => `<option value="${esc(entry.value)}"${entry.value === current ? ' selected' : ''}>${esc(entry.label)}</option>`).join('');
}

function reminderFields(draft: Draft, lang: ViewState['lang']): string {
  const presets = [30, 7, 1];
  const extra = draft.reminders.filter((day) => !presets.includes(day));
  const boxes = [...presets, ...extra].map((day) => {
    const checked = draft.reminders.includes(day) ? ' checked' : '';
    return `<label class="check"><input type="checkbox" name="reminder" value="${day}"${checked}><span>${day}</span></label>`;
  }).join('');
  return `<fieldset><legend>${esc(t(lang, 'fieldReminders'))}</legend><div class="fieldset-body"><div class="checks">${boxes}</div>
    <div class="inline">
      <label class="sr" for="custom-days">${esc(t(lang, 'customDays'))}</label>
      <input id="custom-days" inputmode="numeric" placeholder="${esc(t(lang, 'customDays'))}">
      <button type="button" data-action="add-reminder">${esc(t(lang, 'addReminder'))}</button>
    </div>
    <p class="hint">${esc(t(lang, 'reminderHint'))}</p></div></fieldset>`;
}

function timeline(state: ViewState, item: Item): string {
  const entries = timelineOf(item);
  const rows = entries.map((entry) => {
    const money = entry.amount == null ? '' : esc(formatMoney(entry.amount, entry.currency || 'CNY', state.lang));
    const range = `${entry.validFrom ? `${esc(entry.validFrom)} → ` : ''}${esc(entry.validUntil)}`;
    const thumb = entry.thumbnail ? `<img class="thumb" alt="" src="${esc(entry.thumbnail)}">` : '';
    return `<li class="${entry.label}"><p><strong>${esc(entry.label === 'current' ? t(state.lang, 'historyCurrent') : t(state.lang, 'historyOld'))}</strong> · ${esc(entry.name)}</p>
      <p>${range} ${money}</p>${thumb}
      ${entry.sourceText ? `<details><summary>${esc(t(state.lang, 'viewSource'))}</summary><pre>${esc(entry.sourceText)}</pre></details>` : ''}
    </li>`;
  }).join('');
  return `<section class="timeline"><h2>${esc(t(state.lang, 'historyTitle'))}</h2><ol>${rows}</ol></section>`;
}

function editView(state: ViewState): string {
  const draft = state.draft;
  if (!draft) return '';
  const existing = draft.id ? state.items.find((item) => item.id === draft.id) : undefined;
  const title = draft.mode === 'renew' ? t(state.lang, 'renewTitle') : draft.id ? t(state.lang, 'editTitle') : t(state.lang, 'createTitle');
  const untilLabel = draft.kind === 'subscription' ? t(state.lang, 'fieldCharge') : t(state.lang, 'fieldUntil');
  const fromLabel = draft.kind === 'subscription' ? t(state.lang, 'fieldStart') : t(state.lang, 'fieldFrom');
  const people = options(state.people.map((person) => ({ value: person.id, label: person.name })), draft.personId);
  const categories = options(CATEGORIES.map((category) => ({ value: category, label: categoryLabel(state.lang, category) })), draft.category);
  const currencies = options(CURRENCIES.map((currency) => ({ value: currency, label: currency })), draft.currency);
  const radio = (value: string, label: string, on: boolean) =>
    `<label class="check"><input type="radio" name="cycle" value="${value}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const cycle = draft.kind === 'subscription'
    ? `<fieldset><legend>${esc(t(state.lang, 'fieldCycle'))}</legend><div class="fieldset-body"><div class="choices">
        ${radio('monthly', t(state.lang, 'monthly'), draft.cycle === 'monthly')}
        ${radio('yearly', t(state.lang, 'yearly'), draft.cycle === 'yearly')}
      </div></div></fieldset>`
    : `<fieldset><legend>${esc(t(state.lang, 'fieldCycle'))}</legend><div class="fieldset-body"><div class="choices">
        ${radio('once', t(state.lang, 'cycleOnce'), draft.cycle == null)}
        ${radio('monthly', t(state.lang, 'monthly'), draft.cycle === 'monthly')}
        ${radio('yearly', t(state.lang, 'yearly'), draft.cycle === 'yearly')}
      </div>
        <p class="hint">${esc(t(state.lang, 'recurHint'))}</p>
      </div></fieldset>`;
  const months = options(Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })), draft.dueMonth);
  const recurFields = draft.kind === 'subscription' || draft.cycle == null
    ? ''
    : `<div class="split">
        ${draft.cycle === 'yearly' ? `<label>${esc(t(state.lang, 'fieldDueMonth'))}<select name="dueMonth"><option value=""></option>${months}</select></label>` : ''}
        <label>${esc(t(state.lang, 'fieldDueDay'))}<input name="dueDay" inputmode="numeric" value="${esc(draft.dueDay)}"></label>
      </div>
      <div class="split">
        <label>${esc(t(state.lang, 'fieldSeriesUntil'))}<input type="date" name="seriesUntil" value="${esc(draft.seriesUntil)}"></label>
        <label>${esc(t(state.lang, 'fieldSeriesCount'))}<input name="seriesCount" inputmode="numeric" value="${esc(draft.seriesCount)}"></label>
      </div>
      ${draft.validUntil ? `<p class="hint">${esc(fill(t(state.lang, 'nextDue'), { date: draft.validUntil }))}</p>` : ''}`;
  const categoryField = draft.kind === 'subscription'
    ? ''
    : `<label>${esc(t(state.lang, 'fieldCategory'))}<select name="category">${categories}</select></label>`;
  const photo = draft.thumbnail ? `<img class="preview" alt="${esc(draft.name || t(state.lang, 'fieldPhoto'))}" src="${esc(draft.thumbnail)}">` : '';
  const error = draft.error ? `<p class="error" role="alert">${esc(draft.error)}</p>` : '';
  return `<button type="button" class="back" data-action="back">${esc(t(state.lang, 'back'))}</button>
    <h2>${esc(title)}</h2>
    ${draft.mode === 'renew' ? `<p class="hint">${esc(t(state.lang, 'renewHint'))}</p>` : ''}
    ${error}
    <form id="editor">
      <label>${esc(t(state.lang, 'fieldName'))}<input name="name" required maxlength="80" value="${esc(draft.name)}"></label>
      <label>${esc(t(state.lang, 'fieldPerson'))}<select name="personId">${people}</select></label>
      ${categoryField}
      <div class="split">
        <label>${esc(t(state.lang, 'fieldAmount'))}<input name="amount" inputmode="decimal" value="${esc(draft.amount)}"></label>
        <label>${esc(t(state.lang, 'fieldCurrency'))}<select name="currency">${currencies}</select></label>
      </div>
      <div class="split">
        <label>${esc(fromLabel)}<input type="date" name="validFrom" value="${esc(draft.validFrom)}"></label>
        ${draft.kind !== 'subscription' && draft.cycle
          ? ''
          : `<label>${esc(untilLabel)}<input type="date" name="validUntil" required value="${esc(draft.validUntil)}"></label>`}
      </div>
      ${cycle}
      ${recurFields}
      ${reminderFields(draft, state.lang)}
      <label>${esc(t(state.lang, 'fieldNotes'))}<textarea name="notes" rows="2">${esc(draft.notes)}</textarea></label>
      <label>${esc(t(state.lang, 'fieldSource'))}<textarea name="sourceText" rows="6">${esc(draft.sourceText)}</textarea></label>
      <p class="hint">${esc(t(state.lang, 'sourceHint'))}</p>
      ${photo}
      <div class="actions">
        <button type="button" data-action="reextract">${esc(t(state.lang, 'rerecognize'))}</button>
        <button type="button" data-action="replace-photo">${esc(t(state.lang, 'newPhoto'))}</button>
      </div>
      <button type="submit" class="primary">${esc(draft.mode === 'renew' ? t(state.lang, 'saveRenew') : t(state.lang, 'save'))}</button>
    </form>
    <input id="replace-photo" type="file" accept="image/*" capture="environment" hidden>
    ${existing ? timeline(state, existing) : ''}
    ${existing ? `<button type="button" class="danger wide" data-action="delete" data-id="${esc(existing.id)}">${esc(state.pendingDelete === existing.id ? t(state.lang, 'confirmDelete') : t(state.lang, 'remove'))}</button>` : ''}`;
}

function captureView(state: ViewState): string {
  const progress = Math.round(state.ocr.progress * 100);
  const running = state.ocr.running
    ? `<p id="ocr-label" role="status">${esc(ocrPhase(state.lang, state.ocr.status))} ${progress}%</p>
       <div class="progress" aria-hidden="true"><div id="ocr-bar" style="width:${progress}%"></div></div>
       <button type="button" data-action="cancel-ocr">${esc(t(state.lang, 'cancelOcr'))}</button>`
    : '';
  const error = state.ocr.error ? `<p class="error" role="alert">${esc(t(state.lang, 'ocrFail'))}</p><p class="hint">${esc(state.ocr.error)}</p>` : '';
  return `<button type="button" class="back" data-action="back">${esc(t(state.lang, 'back'))}</button>
    <h2>${esc(t(state.lang, 'captureTitle'))}</h2>
    <p>${esc(t(state.lang, 'captureBody'))}</p>
    <p class="hint">${esc(t(state.lang, 'captureNote'))}</p>
    ${error}${running}
    <div class="actions stack">
      <button type="button" class="primary" data-action="pick-camera">${esc(t(state.lang, 'takePhoto'))}</button>
      <button type="button" data-action="pick-album">${esc(t(state.lang, 'pickAlbum'))}</button>
      <button type="button" data-action="use-sample">${esc(t(state.lang, 'useSample'))}</button>
      <button type="button" data-action="manual" data-kind="expiry">${esc(t(state.lang, 'manualFill'))}</button>
    </div>
    <label>${esc(t(state.lang, 'pasteLabel'))}
      <textarea id="sms" rows="5" placeholder="${esc(t(state.lang, 'pastePlaceholder'))}"></textarea>
    </label>
    <button type="button" class="primary" data-action="parse-sms">${esc(t(state.lang, 'parseSms'))}</button>
    <input id="camera" type="file" accept="image/*" capture="environment" hidden>
    <input id="album" type="file" accept="image/*" hidden>`;
}

function settingsView(state: ViewState): string {
  const people = state.people.map((person) => `<li>
    <label class="sr" for="person-${esc(person.id)}">${esc(t(state.lang, 'fieldName'))}</label>
    <input id="person-${esc(person.id)}" class="person-name" data-person-id="${esc(person.id)}" value="${esc(person.name)}">
    <button type="button" data-action="delete-person" data-id="${esc(person.id)}">${esc(t(state.lang, 'deletePerson'))}</button>
  </li>`).join('');
  return `<section><h2>${esc(t(state.lang, 'settingsPeople'))}</h2><p class="hint">${esc(t(state.lang, 'settingsPeopleHint'))}</p>
      <ul class="people">${people}</ul>
      <div class="actions"><button type="button" data-action="add-person">${esc(t(state.lang, 'addPerson'))}</button>
      <button type="button" class="primary" data-action="save-people">${esc(t(state.lang, 'savePeople'))}</button></div>
    </section>
    <section><h2>${esc(t(state.lang, 'backupTitle'))}</h2>
      <div class="actions stack">
        <button type="button" data-action="export-json">${esc(t(state.lang, 'exportJson'))}</button>
        <button type="button" data-action="pick-backup">${esc(t(state.lang, 'importJson'))}</button>
        <button type="button" data-action="export-all-ics">${esc(t(state.lang, 'exportAllIcs'))}</button>
      </div>
      <label class="check"><input id="replace-backup" type="checkbox"><span>${esc(t(state.lang, 'replaceBackup'))}</span></label>
      <input id="backup-file" type="file" accept="application/json,.json" hidden>
    </section>
    <section><h2>${esc(t(state.lang, 'installTitle'))}</h2>${paragraphs(t(state.lang, 'installBody'))}</section>
    <section><h2>${esc(t(state.lang, 'remindTitle'))}</h2>${paragraphs(t(state.lang, 'remindBody'))}</section>
    <section><h2>${esc(t(state.lang, 'organizeTitle'))}</h2>${paragraphs(t(state.lang, 'organizeBody'))}</section>
    <section><h2>${esc(t(state.lang, 'privacyTitle'))}</h2>${paragraphs(t(state.lang, 'privacyBody'))}</section>
    <button type="button" class="danger wide" data-action="clear">${esc(state.confirmClear ? t(state.lang, 'confirmClear') : t(state.lang, 'clearData'))}</button>`;
}

function templatesView(state: ViewState): string {
  const groups = CATEGORIES.map((category) => {
    const items = TEMPLATES.filter((template) => template.category === category);
    const buttons = items.map((template) => {
      const name = state.lang === 'en' ? template.nameEn : template.nameZh;
      return `<button type="button" data-action="template" data-id="${esc(template.id)}">${esc(name)}</button>`;
    }).join('');
    return `<section><h2>${esc(categoryLabel(state.lang, category))}</h2><div class="actions stack">${buttons}</div></section>`;
  }).join('');
  return `<button type="button" class="back" data-action="back">${esc(t(state.lang, 'back'))}</button>
    <h2>${esc(t(state.lang, 'templatesTitle'))}</h2>
    <p class="hint">${esc(t(state.lang, 'templatesHint'))}</p>
    ${groups}`;
}

function main(state: ViewState): string {
  if (state.view === 'templates') return templatesView(state);
  if (state.view === 'capture') return captureView(state);
  if (state.view === 'edit') return editView(state);
  if (state.view === 'subs') return subsView(state);
  if (state.view === 'settings') return settingsView(state);
  return listView(state);
}

export function renderApp(state: ViewState): string {
  const db = state.dbError ? `<p class="error" role="alert">${esc(state.dbError)}</p>` : '';
  const tabs = (['list', 'subs', 'settings'] as const).map((view) => {
    const label = view === 'list' ? 'navList' : view === 'subs' ? 'navSubs' : 'navSettings';
    const current = state.view === view ? ' aria-current="page"' : '';
    return `<button type="button" data-action="nav" data-view="${view}"${current}>${esc(t(state.lang, label))}</button>`;
  }).join('');
  return `<div class="phone">
    <header class="top">
      <div><p class="eyebrow">${esc(t(state.lang, 'tagline'))}</p><h1>${esc(t(state.lang, 'appName'))}</h1></div>
      <button type="button" class="lang" data-action="lang" aria-label="${esc(t(state.lang, 'langAria'))}">${esc(t(state.lang, 'langButton'))}</button>
    </header>
    <main id="main">${db}${main(state)}</main>
    <nav class="tabbar" aria-label="${esc(t(state.lang, 'appName'))}">${tabs}</nav>
    <p id="toast" class="toast" role="status"${state.toast ? '' : ' hidden'}>${esc(state.toast)}</p>
  </div>`;
}
