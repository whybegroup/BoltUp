import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { paletteOf, fmtTime, fmtMonthShort, dDiff, isToday as checkToday } from '../utils/helpers';
import type { Event } from '../data/mock';
import { GROUPS, MY_NAME } from '../data/mock';

interface EventRowProps {
  ev: Event;
  onPress: () => void;
  isLast?: boolean;
  showGroup?: boolean;
}

export function EventRow({ ev, onPress, isLast, showGroup = true }: EventRowProps) {
  const group  = GROUPS.find(g => g.id === ev.groupId);
  const p      = paletteOf(group);
  const diff   = dDiff(ev.start);
  const isPast = diff < 0;
  const isToday_ = diff === 0;
  const going  = ev.rsvps.filter(r => r.status === 'going');
  const myRsvp = ev.rsvps.find(r => r.name === MY_NAME);
  const cc     = ev.comments?.length || 0;

  const metaParts = [
    fmtTime(ev.start),
    showGroup && group?.name,
    myRsvp?.status === 'going'    ? '✓ Going'    : null,
    myRsvp?.status === 'notGoing' ? '✗ Can\'t go' : null,
    cc > 0 ? `${cc} comment${cc !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: isPast ? Colors.bg : p.row },
        !isLast && styles.rowBorder,
      ]}
      activeOpacity={0.7}
    >
      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{ev.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{metaParts}</Text>
        {ev.location ? (
          <Text style={styles.location} numberOfLines={1}>{ev.location}</Text>
        ) : null}
      </View>

      {/* Calendar badge */}
      <View style={styles.badge}>
        <View style={[styles.badgeTop, { backgroundColor: isToday_ ? Colors.todayRed : p.cal }]}>
          <Text style={styles.badgeMonth}>{isToday_ ? 'TODAY' : fmtMonthShort(ev.start)}</Text>
        </View>
        <View style={styles.badgeBottom}>
          <Text style={styles.badgeDay}>{ev.start.getDate()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text, marginBottom: 2,
  },
  meta: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted,
  },
  location: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, marginTop: 1,
  },
  badge: {
    width: 38, borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.xs,
    flexShrink: 0,
  },
  badgeTop: {
    paddingVertical: 2, alignItems: 'center',
  },
  badgeMonth: {
    fontSize: 9, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.4,
  },
  badgeBottom: {
    backgroundColor: Colors.surface, paddingVertical: 3, alignItems: 'center',
  },
  badgeDay: {
    fontSize: 17, fontFamily: Fonts.bold, color: Colors.text, lineHeight: 20,
  },
});
