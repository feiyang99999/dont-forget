import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics.ts';

describe('ics reminders', () => {
  it('writes floating local events and VALARM offsets', () => {
    const ics = buildIcs([
      {
        uid: 'passport@expiry-butler.local',
        title: '到期: 我 护照',
        description: '姓名, 李娜\n有效期至 2030-10-22',
        date: '2030-10-22',
        alarms: [1, 30, 7, 30],
      },
    ], new Date('2026-10-22T03:04:05Z'));

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20301022T090000');
    expect(ics).toContain('DTEND:20301022T100000');
    expect(ics).toContain('TRIGGER:-P30D');
    expect(ics).toContain('TRIGGER:-P7D');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('UID:passport@expiry-butler.local');
    expect(ics).toContain('李娜');
    expect(ics).toContain('姓名\\, 李娜');
    expect(ics).not.toContain('DTSTART:20301022T090000Z');
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('exports every item and skips a broken date', () => {
    const ics = buildIcs([
      { uid: 'a@expiry-butler.local', title: 'A', description: 'one', date: '2026-12-01', alarms: [7] },
      { uid: 'b@expiry-butler.local', title: 'B', description: 'two', date: 'not-a-date', alarms: [7] },
      { uid: 'c@expiry-butler.local', title: 'C', description: 'three', date: '2027-01-02', alarms: [0] },
    ]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('TRIGGER:PT0S');
    expect(ics).not.toContain('not-a-date');
  });
});
