# Review

Fresh pass over the app after the `idb` switch, looking for wrong behavior, edge cases, accessibility, and privacy (no third-party calls after load, no secrets).

## Fixed in this pass

- **IndexedDB wrapper.** The first draft promised its own request/transaction helpers. `src/db.ts` now uses `idb` `openDB` / `deleteDB`. Stores, the `peopleOrder` meta row, seeding, and `deleteDatabase` (close the cached connection, then delete) are unchanged. `src/db.test.ts` still covers seed order, verbatim text, history thumbnails, replace, delete, and clear. 34 tests pass.
- **Imported thumbnails could leave the phone.** `esc()` stops a thumbnail from breaking out of an attribute, but `src="https://…"` would still be a network request, which breaks the privacy promise. `parseBackup` now keeps only `data:image/jpeg|png|webp;base64,…` under 400KB. Remote URLs and `javascript:` URLs become `null`. The original text is kept. Covered by a unit test.

## Checked, already in the tree

- Card and edit actions expose the item name in `aria-label`. `aria-current="page"` is set only on the active tab.
- Unchecking every reminder stays empty. A blank custom-day field does not add 0. Values outside 0–365 are dropped, and at most eight are kept.
- Any `data-action` click reads the open form and the people fields before re-rendering, so a language toggle or “add reminder” does not wipe what was typed.
- Recognizing a new photo while editing an existing item switches the draft to renew before the new text replaces the field. The old `sourceText` is snapshotted on save.
- `describe()` for the calendar file uses person, category, dates, and amount, plus a note that the original stays in the app. It does not append `sourceText`.
- The only `fetch` in `src/` is `asset('sample-policy.png')` on this origin. OCR options set `workerPath`, `corePath`, and `langPath` to that same origin. No analytics, no beacon, no API key.
- Amount capture includes the fractional part. 保费 is preferred over 保额. Traditional characters are folded to simplified before matching.
- People are ordered by the saved id list, not by IndexedDB key order. The last person, and any person referenced by an item or a revision, cannot be deleted.
- Buttons that are not submitting the form use `type="button"`. Inputs are at least 16px. The sample and icons are local.

## v2

- **Renaming does not orphan old data.** IndexedDB stays `expiry-butler`. A backup with `app: "expiry-butler"` and version 1 still imports. New files say `bie-wang-le` version 2. Old category ids map on import and again when a record is read from the phone. Calendar UIDs stay `@expiry-butler.local`, so a new `.ics` still points at an event the phone already has.
- **A hidden date field was wiping the next due date.** Switching the cycle radio re-reads the form. The monthly form does not include the one-shot date input, and `FormData.get` then returns null. The scrape now updates a control only when that control is on the form.
- **A finished series could not be saved.** Remaining count `0` means the payments are done. Saving treated `0` as invalid and also turned it into “no limit”. `0` is now a real remaining count.
- **Card numbers.** Pasted text is masked to the last four digits before it is shown or stored. The calendar description still omits the original text. A 15–19 digit run is treated as a card; an 11-digit mobile number is left as written.
- **Short months.** `RRULE` uses `BYMONTHDAY=28,29,30,31;BYSETPOS=-1` when a plain `BYMONTHDAY=31` would skip February. The list uses the same last-day clamp. Checked against the unit tests, not against every calendar app.
- **No new network.** SMS parsing and recurrence are local functions. The only `fetch` is still the sample image on this origin.

## Left as limits

- Search is literal. It will not match a synonym or a mistyped character.
- Re-importing the same `.ics` can duplicate events in Apple Calendar. The README says to delete the old event. A renewal needs a new export; the calendar does not update itself.
- The due-soon banner counts every stored item within seven days, including subscriptions, not only the rows on the current screen.
- iOS can still evict site storage. The backup button is the mitigation.
- Tesseract’s own source still contains its CDN default. It is unused when the three paths are set. The browser walkthrough checks the network panel for that.
