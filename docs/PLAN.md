# 别忘了 plan

Personal, privacy-first reminder PWA for one person on iPhone Safari (Home Screen). No account, no backend, no paid service. Static build, relative asset paths. Data stays on the device. After load, the only network is same-origin assets.

Process: plan → search-first → test → implement → review → verify → remember.

v1 (到期管家) shipped OCR, rule extraction, people → category → item, literal search, renewal timeline, subscriptions, `.ics` alarms, and JSON backup. v2 renames the app and adds monthly/yearly bills, pasted SMS, and household templates. IndexedDB stays `expiry-butler` so the phone keeps its records. Old backup files still import.

## v2 scope

In:

- User-facing Chinese name 别忘了. English locale name “Don't Forget”. Manifest, Apple home-screen title, headings, calendar product id, and download names follow that. Backup downloads are `bie-wang-le-backup.json`. Calendar downloads are `bie-wang-le.ics`.
- Monthly bills on a fixed day (房贷, 信用卡还款): name, day of month, optional amount, reminder lead days defaulting to 3 and 1, optional end date and/or remaining count. The list shows the next due date. Days 29–31 fall on the last day of a short month.
- One recurring `VEVENT` per bill: `RRULE:FREQ=MONTHLY` with `BYMONTHDAY`, and `BYSETPOS=-1` when the day would not exist in a short month, plus `UNTIL` and/or `COUNT` when set, and the same `VALARM`s. Yearly recurrence uses `FREQ=YEARLY` for 年检 and 个税年度汇算. Export once.
- Paste SMS or other text. Local rules read 本期应还 / 应还金额, 最后还款日 / 还款日, 尾号, and the bank name, then open the same confirm form as OCR. The pasted text is stored like OCR text. Card numbers longer than a tail are stored as last-4 only.
- Nine categories with quick-add templates. Old category ids map onto these for records already on the phone and for old backups.
- Person → category → item stays.

Out:

- Bank connections, payments, balances, or any request to a bank.
- Web Push, accounts, analytics, LLM extraction.
- A sixth-month recurrence. Templates that are “about every half year” stay one-shot dates the person renews.

## Categories

| id | 中文 | English | Was |
| --- | --- | --- | --- |
| document | 证件 | IDs | `id` |
| car | 车 | Car | |
| house | 房 | Home | `contract` |
| money | 钱 | Money | `bill` |
| insurance | 保险 | Insurance | `insurance` |
| health | 健康 | Health | |
| subscription | 订阅 | Subscriptions | `subscription` |
| household | 家里 | Household | `other` |
| child | 孩子 | Kids | |

Templates live in `src/templates.ts`. Each one sets name, category, one-shot or monthly/yearly, day/month when recurring, and reminder defaults. 房贷 and 信用卡还款 are monthly with reminders 3 and 1. 年检 is yearly. 个税年度汇算 is yearly on 30 June, inside the March–June window.

## Data model

```text
Item {
  ...v1 fields,
  dueDay: number | null,          // 1–31
  dueMonth: number | null,        // 1–12, yearly only
  seriesUntil: string | null,     // last date that may occur
  seriesCount: number | null      // remaining occurrences, including the next one
}
```

`cycle` null means one date in `validUntil`. `monthly` / `yearly` on an expiry item means the next due date is derived from `dueDay` / `dueMonth` and rolled forward on open. That roll is not history. Subscriptions keep their own next-charge roll and the monthly total.

Backup:

```json
{ "app": "bie-wang-le", "version": 2, "exportedAt": "", "people": [], "items": [] }
```

`parseBackup` also accepts `app: "expiry-butler"` version 1. Unknown categories become `household`.

Calendar `UID` stays `{id}@expiry-butler.local` so a new export still targets the event the phone already imported. `PRODID` becomes `-//BieWangLe//CN`. `X-WR-CALNAME` is 别忘了 or Don't Forget, matching the language used for the export.

## Search first (v2)

- Recurrence text: `rrule` 2.8.1 (BSD-3-Clause) depends on `tslib` and expands dates in memory. This app only needs one `RRULE` line plus the short-month clamp, which `BYMONTHDAY` alone skips. Extend `src/ics.ts` and `src/dates.ts`. Do not add the package.
- SMS: `transaction-sms-parser` 3.3.3 (MIT) reads INR debit/credit alerts (`INR 2000 debited…`), not 本期应还 / 最后还款日. Build `src/sms.ts`.

## Checklist

- [x] v1
- [x] Plan v2 (this file)
- [x] Tests for short months, RRULE, SMS samples, old backup import, category map
- [x] Rename, recurring bills, paste box, template picker
- [x] Review notes and decision log
- [x] `npm test`, production build, iPhone-size screenshots
