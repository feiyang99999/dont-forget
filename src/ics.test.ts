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

  it('writes one monthly RRULE that lands on the last day of a short month', () => {
    const ics = buildIcs([
      {
        uid: 'loan@expiry-butler.local',
        title: '还款: 我 房贷',
        description: '房贷',
        date: '2026-03-31',
        alarms: [3, 1],
        recur: { freq: 'MONTHLY', monthDay: 31, month: null, until: '2028-12-31', count: 6 },
      },
    ], new Date('2026-10-22T03:04:05Z'), '别忘了');
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('PRODID:-//BieWangLe//CN');
    expect(unfolded).toContain('X-WR-CALNAME:别忘了');
    expect(unfolded).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1;UNTIL=20281231T090000;COUNT=6');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).not.toContain('UNTIL=20281231T090000Z');
  });

  it('writes a plain monthly day and a yearly tax date', () => {
    const ics = buildIcs([
      {
        uid: 'card@expiry-butler.local',
        title: '还款: 我 信用卡',
        description: '信用卡',
        date: '2026-11-15',
        alarms: [3, 1],
        recur: { freq: 'MONTHLY', monthDay: 15, month: null, until: null, count: null },
      },
      {
        uid: 'tax@expiry-butler.local',
        title: '到期: 我 个税',
        description: '个税',
        date: '2027-06-30',
        alarms: [30, 14],
        recur: { freq: 'YEARLY', monthDay: 30, month: 6, until: null, count: null },
      },
    ], new Date('2026-10-22T00:00:00Z'), "Don't Forget");
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=15');
    expect(unfolded).not.toContain('BYMONTHDAY=15;BYSETPOS');
    expect(unfolded).toContain('RRULE:FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=30');
    expect(unfolded).toContain("X-WR-CALNAME:Don't Forget");
  });
});
