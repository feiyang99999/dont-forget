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

export function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1e8) return null;
  return Math.round(value * 100) / 100;
}
