import { View, StyleSheet } from 'react-native';
import { isGrayedCalendarVisual, type CalendarRsvpVisual } from '../utils/calendarEventRsvp';
import { CalendarEventRsvpFill } from './CalendarEventRsvpFill';

const GRAYED_MARK_BG = '#E4E4E7';

type CalendarEventMarkProps = {
  visual: CalendarRsvpVisual;
  accentColor: string;
  patternId: string;
  variant: 'month' | 'year';
};

const DOT_SIZE = { month: 5, year: 4 } as const;

function dotBase(variant: 'month' | 'year') {
  const size = DOT_SIZE[variant];
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };
}

/** Month/year: gray stripes = no response, yellow stripes = maybe, filled = going, gray = can't go. */
export function CalendarEventMark({
  visual,
  accentColor,
  patternId,
  variant,
}: CalendarEventMarkProps) {
  const base = dotBase(variant);

  if (visual === 'none' || visual === 'maybe') {
    return (
      <View style={[base, styles.ring, { borderColor: accentColor }]} collapsable={false}>
        <CalendarEventRsvpFill
          striped
          backgroundColor={visual === 'maybe' ? '#FFFBEB' : '#E8E8ED'}
          patternId={patternId}
          stripeTone={visual === 'maybe' ? 'maybe' : 'neutral'}
        />
      </View>
    );
  }

  if (visual === 'going') {
    return <View style={[base, { backgroundColor: accentColor }]} collapsable={false} />;
  }

  if (isGrayedCalendarVisual(visual)) {
    return (
      <View
        style={[
          base,
          styles.ring,
          { borderColor: accentColor, backgroundColor: GRAYED_MARK_BG },
        ]}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1,
  },
});
