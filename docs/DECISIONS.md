# Decisions

## Product

- One phone, no account, no server. IndexedDB is the database. JSON backup is the only export of the original document text.
- Reminders are `.ics` files with `VALARM` at 09:00 floating local time. iOS will not schedule local notifications for a site, and Web Push for an installed PWA needs a VAPID server. Web Push is out.
- Calendar files include the name, person, category, dates, and amount. They do not include the OCR text, because iCloud Calendar would sync that text off the phone.
- Ambiguous numeric dates (`01/02/2026`, both parts ≤ 12) are day/month/year. `10/22/2026` is month/day because 22 cannot be a month.
- A renewal writes history. A plain edit does not. Rolling a past subscription charge forward on open is not history.
- Search is a literal substring over fields, verbatim text, and old revisions, scoped by person and category. It is not fuzzy, semantic, or vector search.

## MemPalace, adapted

Adopted: verbatim source text beside extracted fields, person → category → item, a renewal timeline, and literal search over that text. Not adopted: halls, tunnels, a knowledge graph, agents, or a vector database. Those need a backend this app does not have.

## Search first

The ECC search-first pass happened after a first draft of the small utilities already existed. The draft was kept only where a well-maintained, permissive, small library did not fit. Where one did, the custom code was replaced.

| Utility | Decision | What was considered | Why |
| --- | --- | --- | --- |
| OCR | Adopt `tesseract.js` 7.0.0 (Apache-2.0), extend with `src/ocr.ts` | Tesseract.js is the maintained browser port. A from-scratch engine is not a small utility. Transformers.js would download a model at runtime. | The wrapper only pins same-origin `workerPath` / `corePath` / `langPath`, keeps one worker warm, and reports progress. Language data is `@tesseract.js-data/eng` and `chi_sim` `4.0.0_best_int` (about 2.9MB + 1.7MB), not the 20MB full Chinese model. LSTM cores only. |
| Dates, amounts, categories | Build `src/dates.ts` and `src/extract.ts` | `chrono-node` 2.10.3 (MIT) parses natural language, but the default locale reads `01/02/2026` as January 2, and it does not score 有效期至 against 出生 or extract amount and category. `date-fns` 4.4.0 (MIT) `addMonths` does not keep the original day across short months (31 Jan → 28 Feb → 28 Mar), which breaks the subscription rule. Lunar helpers solve a different problem. | The rules are about 200 lines, covered by unit tests, and they implement the keyword and day/month choices this app requires. |
| `.ics` | Build `src/ics.ts` | `ics` 3.12.1 (ISC) is maintained and can emit alarms and floating local time, but it depends on `yup`, `nanoid`, and `runes2`. `ts-ics` is a parser. `ics-js` has not been maintained for years. | Generation here is folding, escaping, one all-day-style event, and `VALARM`. That is smaller than those dependencies. |
| IndexedDB | Adopt `idb` 8.0.4 (ISC) | Jake Archibald’s wrapper, no runtime dependencies, still updated. A hand-rolled promise wrapper was the first draft. `idb-keyval` is a key-value store and does not model `items` / `people` / `meta`. | `src/db.ts` now uses `openDB` / `deleteDB` and keeps the same exported functions. People order stays in the `peopleOrder` meta row because `getAll` is key order. |
| Full-text search | Build `src/search.ts` | `minisearch` 7.2.0 (MIT) is small and has no dependencies, but it tokenizes on whitespace. Chinese OCR text often has no spaces, and the UI needs a flag when the hit is only in a superseded revision. Fuse and FlexSearch are larger than this list. | A lowercase `includes` scan over the stored strings is enough for one person’s documents. |
| Service worker | Adopt `vite-plugin-pwa` 2.0.0 (MIT) | Workbox via the Vite plugin. A hand-written worker would have to reimplement precache, navigation fallback, and updates. | `injectRegister: false`. Registration runs only in the production build. `/ocr/` is excluded from precache (the shell stays ~200KB) and cached CacheFirst on first use. |

## v2 search first

| Utility | Decision | What was considered | Why |
| --- | --- | --- | --- |
| Monthly / yearly `RRULE` | Extend `src/ics.ts` and `src/dates.ts` | `rrule` 2.8.1 (BSD-3-Clause) depends on `tslib` and expands occurrences in memory. Plain `BYMONTHDAY=31` skips months that lack that day. | The file needs one rule line. Days 29–31 are written with `BYSETPOS=-1` so a short month uses its last day. The list computes the same date locally. |
| Bank SMS | Build `src/sms.ts` | `transaction-sms-parser` 3.3.3 (MIT) parses INR debit alerts such as “INR 2000 debited from A/c…”. It does not read 本期应还, 最后还款日, or 尾号. | The samples are Chinese bill and loan reminders. Card numbers are reduced to the last four digits in the stored text. |

## v2 product

- The Chinese name is 别忘了. “Don't Forget” is the English locale only. The home-screen name comes from the manifest, which stays Chinese.
- Old backups import. New backups use `bie-wang-le` version 2 and the file name `bie-wang-le-backup.json`.
- Monthly bills and yearly dates (年检, 个税年度汇算) live on the main list. Subscriptions stay a separate total. Nothing connects to a bank.
- Categories are 证件, 车, 房, 钱, 保险, 健康, 订阅, 家里, 孩子. v1 `id` / `bill` / `contract` / `other` map to 证件 / 钱 / 房 / 家里.

## Lessons

- Tesseract inserts spaces between Chinese characters. `normalizeText` joins spaces and tabs between CJK characters and leaves newlines alone. The sample image is black text on white; white text on the pine background was misread.
- `corePath` is a directory. The WASM is inside the `.wasm.js` glue, so the copy step does not ship a separate `.wasm`.
- Passing local paths stops the runtime from using the jsDelivr default. The string `jsdelivr` still appears inside the library as that default. The app always passes `workerPath`, `corePath`, and `langPath`.
- Re-running OCR on an item that is being edited switches the form to renew, so the previous verbatim text stays on the timeline.
- An imported thumbnail that is not a `data:image/jpeg|png|webp;base64` URL is dropped. Otherwise drawing it could request another site.
