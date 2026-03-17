import { GroupPalettes } from '../constants/theme';
import type { Group } from '../data/mock';

// ── Date formatting ───────────────────────────────────────────────────────────
const DAYS_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_S    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_F    = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function fmtTime(d: Date): string {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

export function fmtDateFull(d: Date): string {
  return `${DAYS_FULL[d.getDay()]}, ${MONTHS_F[d.getMonth()]} ${d.getDate()}`;
}

export function fmtDateShort(d: Date): string {
  return `${MONTHS_S[d.getMonth()]} ${d.getDate()}`;
}

export function fmtMonthShort(d: Date): string {
  return MONTHS_S[d.getMonth()].toUpperCase();
}

export function fmtMonthFull(d: Date): string {
  return MONTHS_F[d.getMonth()];
}

export function dayShort(d: Date): string { return DAYS_SHORT[d.getDay()]; }
export function dayFull(d: Date): string  { return DAYS_FULL[d.getDay()]; }

export function dDiff(d: Date): number {
  return Math.ceil(
    (new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000
  );
}

export function isToday(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function timeAgo(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

// ── Group helpers ─────────────────────────────────────────────────────────────
export function paletteOf(g?: Group | null) {
  return GroupPalettes[g?.palette ?? 0];
}

// ── Avatar color ──────────────────────────────────────────────────────────────
export function avatarColor(name: string): string {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0) * 41, 0) % 360;
  return `hsl(${hue}, 45%, 58%)`;
}

// ── Unique ID ─────────────────────────────────────────────────────────────────
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Days in month ─────────────────────────────────────────────────────────────
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
