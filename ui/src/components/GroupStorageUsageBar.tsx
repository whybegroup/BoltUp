import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { DEFAULT_GROUP_MAX_STORAGE_BYTES, formatStorageBytes } from '../utils/groupStorage';
import {
  GROUP_STORAGE_CATEGORY_COLORS,
  GROUP_STORAGE_CATEGORY_LABELS,
  type GroupStorageCategoryUsage,
} from '../utils/groupStorageCategories';

export function GroupStorageUsageBar({
  usedBytes,
  maxBytes,
  categories,
  onPress,
  showSectionLabel = true,
}: {
  usedBytes: number;
  maxBytes?: number;
  categories?: GroupStorageCategoryUsage[];
  onPress?: () => void;
  showSectionLabel?: boolean;
}) {
  const max = maxBytes && maxBytes > 0 ? maxBytes : DEFAULT_GROUP_MAX_STORAGE_BYTES;
  const used = Math.max(0, usedBytes);
  const unused = Math.max(0, max - used);
  const hasBreakdown = categories != null;
  const filled = hasBreakdown
    ? categories.filter((s) => s.usedBytes > 0)
    : used > 0
      ? [{ id: 'fallback' as const, usedBytes: used, color: Colors.accent }]
      : [];
  const legend = hasBreakdown ? categories : [];

  const usageBlock = (
    <>
      <View
        style={styles.barTrack}
        accessibilityRole="progressbar"
        accessibilityLabel={`${formatStorageBytes(used)} of ${formatStorageBytes(max)} used`}
      >
        {filled.map((seg) => (
          <View
            key={seg.id}
            style={[
              styles.barFill,
              {
                flex: seg.usedBytes,
                backgroundColor:
                  'color' in seg ? seg.color : GROUP_STORAGE_CATEGORY_COLORS[seg.id],
                minWidth: 3,
              },
            ]}
          />
        ))}
        {unused > 0 ? <View style={{ flex: unused }} /> : null}
      </View>
      <Text style={styles.caption}>
        {formatStorageBytes(used)} of {formatStorageBytes(max)} used
      </Text>
      {legend.length > 0 ? (
        <View style={styles.legend}>
          {legend.map((seg) => (
            <View key={seg.id} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: GROUP_STORAGE_CATEGORY_COLORS[seg.id] }]}
              />
              <Text style={styles.legendText}>{GROUP_STORAGE_CATEGORY_LABELS[seg.id]}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.wrap}>
      {showSectionLabel ? <Text style={styles.sectionLabel}>STORAGE</Text> : null}
      <View style={styles.card}>
        {onPress ? (
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Manage storage"
          >
            <View style={styles.headerRow}>
              <View style={styles.headerMain}>{usageBlock}</View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        ) : (
          usageBlock
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerMain: { flex: 1 },
  caption: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
});
