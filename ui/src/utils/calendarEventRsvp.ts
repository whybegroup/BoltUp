import type { EventDetailed } from '@moijia/client';
import { Colors } from '../constants/theme';
import { getGroupColor } from './helpers';
import type { CalendarStripeTone } from '../components/CalendarEventRsvpFill';

export type CalendarRsvpVisual = 'going' | 'maybe' | 'none' | 'notGoing';

const GRAYED_CAL_BG = '#E4E4E7';
const GRAYED_CAL_TEXT = '#A1A1AA';
const MAYBE_STRIPE_BASE = '#FFFBEB';

export function getMyCalendarRsvpVisual(
  ev: EventDetailed,
  meId?: string
): CalendarRsvpVisual {
  if (!meId) return 'none';
  const my = (ev.rsvps ?? []).find((r) => r.userId === meId);
  if (!my) return 'none';
  if (my.status === 'notGoing') return 'notGoing';
  if (my.status === 'going') return 'going';
  if (my.status === 'maybe') return 'maybe';
  return 'none';
}

export function filterCalendarEvents(
  events: EventDetailed[],
  meId?: string,
  filterRsvp: string[] = []
): EventDetailed[] {
  if (!meId) return events;
  return events.filter((ev) => {
    const visual = getMyCalendarRsvpVisual(ev, meId);
    if (visual === 'notGoing') {
      return filterRsvp.includes('notGoing');
    }
    return true;
  });
}

export function isGrayedCalendarVisual(visual: CalendarRsvpVisual): boolean {
  return visual === 'notGoing';
}

export type CalendarEventAppearance = {
  visual: CalendarRsvpVisual;
  striped: boolean;
  stripeTone: CalendarStripeTone;
  grayed: boolean;
  backgroundColor: string;
  borderLeftColor: string;
  textColor: string;
  dotColor: string;
};

export function getCalendarEventAppearance(
  visual: CalendarRsvpVisual,
  groupPalette: ReturnType<typeof getGroupColor>
): CalendarEventAppearance {
  if (visual === 'going') {
    return {
      visual,
      striped: false,
      stripeTone: 'neutral',
      grayed: false,
      backgroundColor: groupPalette.fill,
      borderLeftColor: groupPalette.dot,
      textColor: Colors.text,
      dotColor: groupPalette.dot,
    };
  }
  if (visual === 'maybe') {
    return {
      visual,
      striped: true,
      stripeTone: 'maybe',
      grayed: false,
      backgroundColor: MAYBE_STRIPE_BASE,
      borderLeftColor: groupPalette.dot,
      textColor: Colors.text,
      dotColor: groupPalette.dot,
    };
  }
  if (visual === 'notGoing') {
    return {
      visual,
      striped: false,
      stripeTone: 'neutral',
      grayed: true,
      backgroundColor: GRAYED_CAL_BG,
      borderLeftColor: groupPalette.dot,
      textColor: GRAYED_CAL_TEXT,
      dotColor: groupPalette.dot,
    };
  }
  return {
    visual: 'none',
    striped: true,
    stripeTone: 'neutral',
    grayed: false,
    backgroundColor: '#E8E8ED',
    borderLeftColor: groupPalette.dot,
    textColor: Colors.text,
    dotColor: groupPalette.dot,
  };
}

export function calendarAppearanceForEvent(
  ev: EventDetailed,
  groupPalette: ReturnType<typeof getGroupColor>,
  meId?: string
): CalendarEventAppearance {
  return getCalendarEventAppearance(getMyCalendarRsvpVisual(ev, meId), groupPalette);
}
