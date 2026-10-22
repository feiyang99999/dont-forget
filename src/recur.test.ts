import { describe, expect, it } from 'vitest';
import { advanceSeries, nextMonthly, nextYearly } from './dates.ts';

describe('fixed day of month', () => {
  it('uses the last day when the month is short', () => {
    expect(nextMonthly(31, '2026-02-01')).toBe('2026-02-28');
    expect(nextMonthly(31, '2028-02-01')).toBe('2028-02-29');
    expect(nextMonthly(30, '2026-02-10')).toBe('2026-02-28');
    expect(nextMonthly(29, '2026-02-01')).toBe('2026-02-28');
    expect(nextMonthly(31, '2026-04-01')).toBe('2026-04-30');
    expect(nextMonthly(15, '2026-10-22')).toBe('2026-11-15');
    expect(nextMonthly(22, '2026-10-22')).toBe('2026-10-22');
  });

  it('rolls a yearly date and clamps 29 February', () => {
    expect(nextYearly(6, 30, '2026-01-01')).toBe('2026-06-30');
    expect(nextYearly(6, 30, '2026-07-01')).toBe('2027-06-30');
    expect(nextYearly(2, 29, '2026-03-01')).toBe('2027-02-28');
    expect(nextYearly(2, 29, '2027-03-01')).toBe('2028-02-29');
  });

  it('moves a past series onto the next due date and spends a remaining count', () => {
    expect(advanceSeries({
      cycle: 'monthly',
      dueDay: 31,
      dueMonth: null,
      validUntil: '2026-01-31',
      seriesUntil: null,
      seriesCount: 3,
    }, '2026-03-01')).toEqual({ validUntil: '2026-03-31', seriesCount: 1, ended: false });
  });

  it('stops after the last payment or the end date', () => {
    expect(advanceSeries({
      cycle: 'monthly',
      dueDay: 31,
      dueMonth: null,
      validUntil: '2026-01-31',
      seriesUntil: null,
      seriesCount: 2,
    }, '2026-03-01')).toMatchObject({ seriesCount: 0, ended: true });

    expect(advanceSeries({
      cycle: 'monthly',
      dueDay: 31,
      dueMonth: null,
      validUntil: '2026-05-31',
      seriesUntil: '2026-06-30',
      seriesCount: null,
    }, '2026-07-01')).toEqual({ validUntil: '2026-06-30', seriesCount: null, ended: true });
  });
});
