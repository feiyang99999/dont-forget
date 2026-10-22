export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  date: string;
  alarms: number[];
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

export function buildIcs(events: IcsEvent[], now = new Date()): string {
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
    return [`${lines.map((line) => fold(line)).join('')}${alarms.map((days) => alarm(days, event.title)).join('')}END:VEVENT\r\n`];
  }).join('');
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ExpiryButler//CN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n${body}END:VCALENDAR\r\n`;
}
