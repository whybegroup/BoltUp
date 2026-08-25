import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../constants/theme';

type CollapsibleFiltersButtonProps = {
  expanded: boolean;
  onToggle: () => void;
  filtersActive?: boolean;
  onReset?: () => void;
};

export function CollapsibleFiltersButton({
  expanded,
  onToggle,
  filtersActive = false,
  onReset,
}: CollapsibleFiltersButtonProps) {
  const fg = expanded ? Colors.surface : Colors.text;
  return (
    <View style={styles.wrap}>
      {onReset && filtersActive ? (
        <TouchableOpacity
          onPress={onReset}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Reset filters"
          style={styles.resetBtn}
        >
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={[
          styles.btn,
          expanded && styles.btnExpanded,
          filtersActive && !expanded && styles.btnActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Filters"
        accessibilityState={{ expanded, selected: filtersActive }}
      >
      <Svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke={fg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
      </Svg>
      <Text
        style={[
          styles.label,
          expanded && styles.labelExpanded,
          filtersActive && !expanded && styles.labelActive,
        ]}
      >
        Filters
      </Text>
      {filtersActive ? (
        <View style={[styles.dot, expanded && styles.dotOnExpanded]} />
      ) : null}
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={fg} />
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSub,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  btnExpanded: {
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
  btnActive: {
    borderColor: Colors.accent,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  labelExpanded: {
    color: Colors.surface,
  },
  labelActive: {
    color: Colors.text,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  dotOnExpanded: {
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
});
