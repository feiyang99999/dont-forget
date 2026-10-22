# Expiry Butler v1 plan

Personal, privacy-first expiry and renewal PWA for one person on iPhone Safari (Home Screen). No account, no backend, no paid service. Static build, relative asset paths, so it can sit on GitHub Pages under a subpath.

Process for this work follows the ECC loop: plan → test → implement → review → verify → remember.

## Scope

In:

- On-device OCR (Tesseract.js, English + Simplified Chinese) with worker, core, and language data copied out of npm packages at build time. No third-party CDN at runtime.
- Rule-based extraction (no LLM): title, category, amount, currency, valid-from, valid-until. Editable confirm form.
- Downscaled JPEG thumbnail plus the full raw OCR text stored with every item.
- Re-run extraction on the stored raw text.
- People (wings) → category (rooms) → item (drawer). Default people: 我 / 伴侣 / 孩子 / 父母, editable.
- Literal search over name, notes, raw text, and superseded revisions, narrowed by person and category.
- Renewal keeps the previous version on a timeline instead of overwriting it. Direct edits fix typos and do not create history.
- Subscriptions: price, currency, monthly/yearly, next charge date, monthly total (yearly ÷ 12), same reminders.
- Default reminders 30 / 7 / 1 days before, editable. Export one or all as `.ics` with `VALARM`.
- In-app “due soon” banner. No Web Push (iOS cannot schedule local notifications without a push server).
- IndexedDB. JSON backup export/import, including raw text, history, and thumbnails.
- Chinese / English UI, Chinese default. Offline shell via service worker + manifest + icons. Safe-area layout.
- Unit tests for extraction, date math, ICS, and IndexedDB/backup round-trip.

Out:

- Accounts, servers, analytics, LLM extraction, vector search, MemPalace halls/tunnels/knowledge-graph.
- Web Push.
- Keeping the original full-resolution photo (only a thumbnail plus the verbatim text).

## Architecture

Vite + TypeScript, no UI framework. `vite build` emits a static `dist/`.

- `src/extract.ts` — pure rules
- `src/dates.ts` — today, urgency, next billing date, reminder normalization
- `src/ics.ts` — calendar text
- `src/history.ts` — supersede + timeline
- `src/search.ts` — scoped literal scan
- `src/backup.ts` — JSON backup
- `src/db.ts` — IndexedDB via `idb` (`items`, `people`, `meta`)
- `src/ocr.ts` — Tesseract, same-origin paths only
- `src/app.ts` / `src/render.ts` — UI
- `public/ocr/` — generated at prebuild, gitignored
- Service worker precaches the app shell and caches `/ocr/` at runtime (CacheFirst). It does not call a network API.

`base` is `./` for production so GitHub Pages project sites work. Override with `BASE_PATH` if a host needs an absolute prefix.

## Data model

```text
Person { id, name, createdAt }          // wing
Item   {                                // current drawer
  id, kind: expiry | subscription,
  name, category, personId,
  amount, currency,
  validFrom, validUntil,                // temporal window; validUntil is expiry or next charge
  cycle, reminders, notes,
  sourceText,                           // verbatim OCR or pasted text, never dropped on save
  thumbnail,                            // small data-URL JPEG or null
  createdAt, updatedAt,
  history: Revision[]                   // superseded drawers, newest first
}
Revision { same factual fields, recordedAt, supersededAt }
```

Backup file:

```json
{ "app": "expiry-butler", "version": 1, "exportedAt": "", "people": [], "items": [] }
```

Ambiguous numeric dates (`01/02/2026`, both parts ≤ 12) are day/month/year. `10/22/2026` is month/day because 22 cannot be a month.

Subscription charge dates in the past roll forward on open. That is not a history event. History is written only by the explicit renew action.

## Checklist

- [x] Choose stack and data model
- [x] Draft extraction, dates, ICS, history, search, backup modules
- [x] Unit tests for extraction, date math, ICS, IndexedDB + backup round-trip
- [x] IndexedDB module (`idb`, same exported API)
- [x] Mobile UI: capture/OCR, confirm, list, subscriptions, settings, timeline
- [x] Self-host OCR assets, sample policy image, icons, manifest, service worker
- [x] Chinese README and GitHub Pages workflow
- [x] Fresh-eyes review (`docs/REVIEW.md`) and fixes
- [x] Search-first decisions (`docs/DECISIONS.md`)
- [ ] Build, tests, mobile-viewport walkthrough, screenshots
