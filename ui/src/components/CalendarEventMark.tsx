import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { isGrayedCalendarVisual, type CalendarRsvpVisual } from '../utils/calendarEventRsvp';
import { CalendarEventRsvpFill } from './CalendarEventRsvpFill';

const GRAYED_MARK_BG = '#E4E4E7';

type CalendarEventMarkProps = {
  visual: CalendarRsvpVisual;
  accentColor: string;
  patternId: string;
  selected?: boolean;
  variant: 'month' | 'year';
};

/** Month/year: gray stripes = no response, yellow stripes = maybe, white = going, gray = can't go. */
export function CalendarEventMark({
  visual,
  accentColor,
  patternId,
  selected = false,
  variant,
}: CalendarEventMarkProps) {
  const borderColor = selected ? Colors.accentFg : accentColor;
  const markWrap = variant === 'month' ? styles.monthStripeMark : styles.yearStripeMark;

  if (visual === 'none' || visual === 'maybe') {
    return (
      <View style={[markWrap, { borderLeftColor: borderColor }]}>
        <CalendarEventRsvpFill
          striped
          backgroundColor={visual === 'maybe' ? '#FFFBEB' : '#E8E8ED'}
          patternId={patternId}
          stripeTone={visual === 'maybe' ? 'maybe' : 'neutral'}
          onDarkBackground={selected}
        />
      </View>
    );
  }

  if (visual === 'going') {
    return (
      <View
        style={[
          variant === 'month' ? styles.monthSolidMark : styles.yearSolidMark,
          { borderLeftColor: borderColor, backgroundColor: Colors.surface },
        ]}
      />
    );
  }

  if (isGrayedCalendarVisual(visual)) {
    return (
      <View
        style={[
          variant === 'month' ? styles.monthSolidMark : styles.yearSolidMark,
          { borderLeftColor: borderColor, backgroundColor: GRAYED_MARK_BG },
        ]}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  monthStripeMark: {
    width: 12,
    height: 4,
    borderRadius: 1,
    borderLeftWidth: 2,
    overflow: 'hidden',
  },
  yearStripeMark: {
    width: 9,
    height: 3,
    borderRadius: 1,
    borderLeftWidth: 1.5,
    overflow: 'hidden',
  },
  monthSolidMark: {
    width: 12,
    height: 4,
    borderRadius: 1,
    borderLeftWidth: 2,
  },
  yearSolidMark: {
    width: 9,
    height: 3,
    borderRadius: 1,
    borderLeftWidth: 1.5,
  },
});
