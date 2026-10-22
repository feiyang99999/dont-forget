import type { Cycle } from './types.ts';

export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function daysUntil(iso: string, today = todayIso()): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export type Urgency = 'overdue' | 'week' | 'month' | 'later';

export function urgency(iso: string, today = todayIso()): Urgency {
  const days = daysUntil(iso, today);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'later';
}

function clampIso(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, last);
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

/** Move a billing date forward by whole months or years until it is today or later. */
export function nextOccurrence(iso: string, cycle: Cycle, today: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return iso;
  if (iso >= today) return iso;
  const startYear = parts[0] ?? 0;
  const startMonth = parts[1] ?? 1;
  const startDay = parts[2] ?? 1;
  let year = startYear;
  let month = startMonth;
  const step = cycle === 'yearly' ? 12 : 1;
  let current = iso;
  for (let guard = 0; guard < 2400 && current < today; guard += 1) {
    month += step;
    year += Math.floor((month - 1) / 12);
    month = ((month - 1) % 12) + 1;
    current = clampIso(year, month, startDay);
  }
  return current;
}

export function normalizeReminders(values: number[]): number[] {
  const picked = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value > 365) continue;
    picked.add(value);
  }
  return [...picked].sort((a, b) => b - a).slice(0, 8);
}

export function clampDay(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(Math.max(1, day), last);
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

/** Next date on this day-of-month that is today or later. 29–31 use the month's last day. */
export function nextMonthly(day: number, today: string): string {
  const [yearText, monthText] = today.split('-');
  let year = Number(yearText);
  let month = Number(monthText);
  let candidate = clampDay(year, month, day);
  if (candidate < today) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    candidate = clampDay(year, month, day);
  }
  return candidate;
}

export function nextYearly(month: number, day: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const candidate = clampDay(year, month, day);
  return candidate >= today ? candidate : clampDay(year + 1, month, day);
}

function stepDue(cycle: Cycle, dueDay: number, dueMonth: number | null, fromIso: string): string {
  const [yearText, monthText] = fromIso.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (cycle === 'yearly') return clampDay(year + 1, dueMonth ?? month, dueDay);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return clampDay(nextYear, nextMonth, dueDay);
}

export interface SeriesInput {
  cycle: Cycle;
  dueDay: number;
  dueMonth: number | null;
  validUntil: string;
  seriesUntil: string | null;
  seriesCount: number | null;
}

/** Roll a past due date forward. Remaining count includes the next occurrence. */
export function advanceSeries(input: SeriesInput, today: string): { validUntil: string; seriesCount: number | null; ended: boolean } {
  let validUntil = input.validUntil;
  let count = input.seriesCount;
  if (count != null && count <= 0) return { validUntil, seriesCount: 0, ended: true };
  if (input.seriesUntil && validUntil > input.seriesUntil) return { validUntil, seriesCount: count, ended: true };
  for (let guard = 0; guard < 2400 && validUntil < today; guard += 1) {
    if (count != null && count <= 1) return { validUntil, seriesCount: 0, ended: true };
    const next = stepDue(input.cycle, input.dueDay, input.dueMonth, validUntil);
    if (input.seriesUntil && next > input.seriesUntil) return { validUntil, seriesCount: count, ended: true };
    if (count != null) count -= 1;
    validUntil = next;
  }
  const ended = (count != null && count <= 0) || (input.seriesUntil != null && validUntil > input.seriesUntil);
  return { validUntil, seriesCount: count, ended };
}

export function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1e8) return null;
  return Math.round(value * 100) / 100;
}
