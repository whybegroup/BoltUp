import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';

export type CalendarStripeTone = 'neutral' | 'maybe';

const NEUTRAL_STRIPE_BASE = '#E8E8ED';
const NEUTRAL_STRIPE_LINE = '#FFFFFF';
const MAYBE_STRIPE_BASE = '#FFFBEB';
const MAYBE_STRIPE_LINE = '#FDE68A';

const STRIPE_BASE_ON_DARK = 'rgba(255,255,255,0.14)';
const STRIPE_LINE_ON_DARK = 'rgba(255,255,255,0.72)';
const MAYBE_STRIPE_BASE_ON_DARK = 'rgba(254, 243, 199, 0.35)';
const MAYBE_STRIPE_LINE_ON_DARK = 'rgba(253, 230, 138, 0.85)';

const STRIPE_PERIOD = 7;
const STRIPE_WIDTH = 1;

export type CalendarEventRsvpFillProps = {
  striped: boolean;
  backgroundColor: string;
  patternId: string;
  stripeTone?: CalendarStripeTone;
  onDarkBackground?: boolean;
};

function stripeColors(tone: CalendarStripeTone, onDark: boolean) {
  if (tone === 'maybe') {
    return onDark
      ? { base: MAYBE_STRIPE_BASE_ON_DARK, line: MAYBE_STRIPE_LINE_ON_DARK }
      : { base: MAYBE_STRIPE_BASE, line: MAYBE_STRIPE_LINE };
  }
  return onDark
    ? { base: STRIPE_BASE_ON_DARK, line: STRIPE_LINE_ON_DARK }
    : { base: NEUTRAL_STRIPE_BASE, line: NEUTRAL_STRIPE_LINE };
}

function webStripeBackground(tone: CalendarStripeTone, onDark: boolean): Record<string, string> {
  const { base, line } = stripeColors(tone, onDark);
  return {
    backgroundColor: base,
    backgroundImage: `repeating-linear-gradient(
      135deg,
      ${line} 0px,
      ${line} ${STRIPE_WIDTH}px,
      ${base} ${STRIPE_WIDTH}px,
      ${base} ${STRIPE_PERIOD}px
    )`,
  };
}

function NativeStripePattern({
  patternId,
  tone,
  onDark,
}: {
  patternId: string;
  tone: CalendarStripeTone;
  onDark: boolean;
}) {
  const safeId = patternId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const { base, line } = stripeColors(tone, onDark);
  const tile = STRIPE_PERIOD;

  return (
    <Svg style={styles.fill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <Pattern
          id={safeId}
          patternUnits="userSpaceOnUse"
          width={tile}
          height={tile}
          patternTransform={`rotate(45 ${tile / 2} ${tile / 2})`}
        >
          <Rect x={-tile} y={-tile} width={tile * 3} height={tile * 3} fill={base} />
          <Line
            x1={tile / 2}
            y1={-tile}
            x2={tile / 2}
            y2={tile * 2}
            stroke={line}
            strokeWidth={STRIPE_WIDTH}
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${safeId})`} />
    </Svg>
  );
}

export function CalendarEventRsvpFill({
  striped,
  backgroundColor,
  patternId,
  stripeTone = 'neutral',
  onDarkBackground = false,
}: CalendarEventRsvpFillProps) {
  if (!striped) {
    return <View style={[styles.fill, { backgroundColor }]} pointerEvents="none" collapsable={false} />;
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[styles.fill, webStripeBackground(stripeTone, onDarkBackground) as object]}
        pointerEvents="none"
        collapsable={false}
      />
    );
  }

  return (
    <View style={styles.fill} pointerEvents="none" collapsable={false}>
      <NativeStripePattern patternId={patternId} tone={stripeTone} onDark={onDarkBackground} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
