import { Fragment } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../constants/theme';

export type BreadcrumbSegment = {
  label: string;
  onPress?: () => void;
  /** When true (typically on the last segment), shows a small chevron after the label. */
  showSwitchChevron?: boolean;
  /** When true, chevron points up (dropdown open). */
  switchChevronOpen?: boolean;
  /** Optional handler for switch chevron press (separate from label press). */
  onSwitchChevronPress?: (anchor: { x: number; y: number }) => void;
};

export type GroupsBreadcrumbTrailProps = {
  segments: BreadcrumbSegment[];
};

export function GroupsBreadcrumbTrail({ segments }: GroupsBreadcrumbTrailProps) {
  return (
    <View style={styles.breadcrumbBar}>
      <View style={styles.breadcrumbInner}>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const textStyle =
            segments.length === 1 ? styles.breadcrumbLink : isLast ? styles.breadcrumbCurrent : styles.breadcrumbLink;
          const labelNode = (
            <Text style={textStyle} numberOfLines={1}>
              {seg.label}
            </Text>
          );
          const chevronNode = seg.showSwitchChevron ? (
            <Ionicons
              name={seg.switchChevronOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.textMuted}
              style={styles.breadcrumbChevron}
            />
          ) : null;
          return (
            <Fragment key={`${seg.label}-${i}`}>
              {i > 0 ? <Text style={styles.breadcrumbSep}>{' > '}</Text> : null}
              <View
                style={[
                  styles.breadcrumbSegTouchable,
                  isLast && segments.length > 1 && styles.breadcrumbSegTouchableLast,
                ]}
              >
                {seg.onPress ? (
                  <TouchableOpacity
                    onPress={seg.onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={seg.label}
                  >
                    {labelNode}
                  </TouchableOpacity>
                ) : (
                  labelNode
                )}
                {chevronNode ? (
                  seg.onSwitchChevronPress ? (
                    <TouchableOpacity
                      onPress={(e: GestureResponderEvent) =>
                        seg.onSwitchChevronPress?.({
                          x: e.nativeEvent.pageX,
                          y: e.nativeEvent.pageY,
                        })
                      }
                      style={styles.breadcrumbChevronButton}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch from ${seg.label}`}
                    >
                      {chevronNode}
                    </TouchableOpacity>
                  ) : (
                    chevronNode
                  )
                ) : null}
              </View>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  breadcrumbBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.bg,
  },
  breadcrumbInner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  breadcrumbSep: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted },
  breadcrumbLink: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textSub },
  breadcrumbCurrent: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  breadcrumbSegTouchable: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  breadcrumbSegTouchableLast: { flex: 1, minWidth: 0 },
  breadcrumbChevronButton: { marginLeft: 2 },
  breadcrumbChevron: { flexShrink: 0, marginTop: 1 },
});
