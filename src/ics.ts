export interface IcsRecur {
  freq: 'MONTHLY' | 'YEARLY';
  monthDay: number;
  month: number | null;
  until: string | null;
  count: number | null;
}

export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  date: string;
  alarms: number[];
  recur?: IcsRecur | null;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (current && bytes + size > 73) {
      parts.push(current);
      current = ` ${char}`;
      bytes = 1 + size;
    } else {
      current += char;
      bytes += size;
    }
  }
  if (current) parts.push(current);
  return `${parts.join('\r\n')}\r\n`;
}

function formatUtc(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function compactDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.replace(/-/g, '');
}

function monthHasDay(month: number, day: number): boolean {
  return new Date(Date.UTC(2026, month, 0)).getUTCDate() >= day;
}

function rrule(recur: IcsRecur): string {
  const shortMonth = recur.freq === 'MONTHLY'
    ? recur.monthDay >= 29
    : recur.month === 2
      ? recur.monthDay >= 29
      : recur.month != null && !monthHasDay(recur.month, recur.monthDay);
  const byDay = shortMonth
    ? `BYMONTHDAY=${Array.from({ length: recur.monthDay - 27 }, (_, index) => 28 + index).join(',')};BYSETPOS=-1`
    : `BYMONTHDAY=${recur.monthDay}`;
  const parts = [
    `FREQ=${recur.freq}`,
    recur.freq === 'YEARLY' && recur.month ? `BYMONTH=${recur.month}` : '',
    byDay,
    recur.until && /^\d{4}-\d{2}-\d{2}$/.test(recur.until) ? `UNTIL=${recur.until.replace(/-/g, '')}T090000` : '',
    recur.count != null && recur.count > 0 ? `COUNT=${recur.count}` : '',
  ].filter(Boolean);
  return `RRULE:${parts.join(';')}`;
}

function alarm(days: number, description: string): string {
  const trigger = days > 0 ? `-P${days}D` : 'PT0S';
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(description)}`,
    `TRIGGER:${trigger}`,
    'END:VALARM',
  ].map((line) => fold(line)).join('');
}

export function buildIcs(events: IcsEvent[], now = new Date(), calendarName = '别忘了'): string {
  const stamp = formatUtc(now);
  const body = events.flatMap((event) => {
    const day = compactDate(event.date);
    if (!day) return [];
    const alarms = [...new Set(event.alarms.filter((days) => days >= 0 && days <= 365))].sort((a, b) => b - a);
    const lines = [
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${day}T090000`,
      `DTEND:${day}T100000`,
      `SUMMARY:${icsEscape(event.title)}`,
      `DESCRIPTION:${icsEscape(event.description)}`,
    ];
    if (event.recur && event.recur.count !== 0) lines.push(rrule(event.recur));
    return [`${lines.map((line) => fold(line)).join('')}${alarms.map((days) => alarm(days, event.title)).join('')}END:VEVENT\r\n`];
  }).join('');
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BieWangLe//CN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    'METHOD:PUBLISH',
  ].map((line) => fold(line)).join('');
  return `${header}${body}END:VCALENDAR\r\n`;
}
