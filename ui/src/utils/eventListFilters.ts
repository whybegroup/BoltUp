import type { EventDetailed } from '@moijia/client';

export type EventDateMode = 'specific' | 'now' | 'allTime';

export type EventListFilterState = {
  filterRsvp: string[];
  filterNeeds: boolean;
  showAdvancedFilters: boolean;
  startDateText: string;
  endDateText: string;
  startMode: EventDateMode;
  endMode: EventDateMode;
};

export function getDefaultEventFilterDateTexts(): {
  todayIso: string;
  defaultStartSpecificText: string;
  defaultEndSpecificText: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayIso = `${y}-${m}-${d}`;
  const defaultStartSpecificText = `${todayIso} 00:00`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ty = tomorrow.getFullYear();
  const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const td = String(tomorrow.getDate()).padStart(2, '0');
  const defaultEndSpecificText = `${ty}-${tm}-${td} 00:00`;
  return { todayIso, defaultStartSpecificText, defaultEndSpecificText };
}

export function formatLocalDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function formatLocalTimeTwelveHour(d: Date): string {
  const hours24 = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${minutes} ${suffix}`;
}

export function mergeFilterDraftDatePart(base: Date, picked: Date): Date {
  const n = new Date(base);
  n.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return n;
}

export function mergeFilterDraftTimePart(base: Date, picked: Date): Date {
  const n = new Date(base);
  n.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return n;
}

export function webFilterModalInputStyle(): Record<string, string | number> {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #18181B',
    backgroundColor: '#F4F4F5',
    fontSize: 14,
    color: '#18181B',
    fontFamily: 'DMSans_500Medium',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 4,
  };
}

export function parseFilterDateTime(txt: string): Date | null {
  const t = txt.trim();
  if (!t) return null;
  const [datePart, timePart] = t.split(' ');
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  const [ys, ms, ds] = parts;
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  let hh = 0;
  let mm = 0;
  if (timePart) {
    const [hs, mins] = timePart.split(':');
    hh = Number(hs) || 0;
    mm = Number(mins) || 0;
  }
  const dt = new Date(y, m - 1, d, hh, mm);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseBound(txt: string): Date | null {
  return parseFilterDateTime(txt);
}

function inclusiveEndCutoff(b: Date): Date {
  if (
    b.getHours() === 0 &&
    b.getMinutes() === 0 &&
    b.getSeconds() === 0 &&
    b.getMilliseconds() === 0
  ) {
    return new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999);
  }
  return b;
}

export function filterEventsForList(
  events: EventDetailed[],
  filters: EventListFilterState,
  currentUserId: string | undefined
): EventDetailed[] {
  const startBound =
    filters.startMode === 'now'
      ? new Date()
      : filters.startMode === 'specific'
        ? (parseBound(filters.startDateText) ?? null)
        : null;

  const endBound =
    filters.endMode === 'now'
      ? new Date()
      : filters.endMode === 'specific'
        ? parseBound(filters.endDateText)
        : null;

  const endFilterCutoff = endBound != null ? inclusiveEndCutoff(endBound) : null;

  return events.filter((ev) => {
    const evStart = typeof ev.start === 'string' ? new Date(ev.start) : ev.start;
    const evEnd = typeof ev.end === 'string' ? new Date(ev.end) : ev.end;

    if (startBound && evEnd.getTime() <= startBound.getTime()) return false;
    if (endFilterCutoff && evStart.getTime() > endFilterCutoff.getTime()) return false;

    const rsvps = ev.rsvps || [];
    const myGoing = !!rsvps.find((r) => r.userId === currentUserId && r.status === 'going');
    const myNotGoing = !!rsvps.find((r) => r.userId === currentUserId && r.status === 'notGoing');
    const myMaybe = !!rsvps.find((r) => r.userId === currentUserId && r.status === 'maybe');
    const myAnyRsvp = !!rsvps.find((r) => r.userId === currentUserId);

    if (filters.filterRsvp.length) {
      const matchesRsvp =
        (filters.filterRsvp.includes('going') && myGoing) ||
        (filters.filterRsvp.includes('maybe') && myMaybe) ||
        (filters.filterRsvp.includes('notGoing') && myNotGoing) ||
        (filters.filterRsvp.includes('none') && !myAnyRsvp);
      if (!matchesRsvp) return false;
    }

    if (
      filters.filterNeeds &&
      !(ev.minAttendees && rsvps.filter((r) => r.status === 'going').length < ev.minAttendees)
    ) {
      return false;
    }

    return true;
  });
}

export function eventListFiltersActive(
  filters: EventListFilterState,
  defaults: { defaultStartSpecificText: string; defaultEndSpecificText: string }
): boolean {
  return !!(
    filters.filterRsvp.length ||
    filters.filterNeeds ||
    filters.startMode !== 'now' ||
    filters.endMode !== 'allTime' ||
    filters.startDateText !== defaults.defaultStartSpecificText ||
    filters.endDateText !== defaults.defaultEndSpecificText
  );
}

export const RSVP_FILTER_OPTIONS = [
  ['going', 'Going'],
  ['maybe', 'Maybe'],
  ['notGoing', "Can't go"],
  ['none', 'No response'],
] as const;
