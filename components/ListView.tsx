import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import { dDiff } from '../utils/helpers';
import { EventRow } from './EventRow';
import type { Event } from '../data/mock';

interface ListViewProps {
  events: Event[];
  onSelect: (ev: Event) => void;
  showGroup?: boolean;
}

export function ListView({ events, onSelect, showGroup = true }: ListViewProps) {
  const scrollRef = useRef<ScrollView>(null);

  const past     = events.filter(e => dDiff(e.start) < 0);
  const upcoming = events.filter(e => dDiff(e.start) >= 0);

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
      {/* Past */}
      {past.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>Past</Text>
          <View style={styles.card}>
            {past.map((ev, i) => (
              <EventRow
                key={ev.id}
                ev={ev}
                onPress={() => onSelect(ev)}
                isLast={i === past.length - 1}
                showGroup={showGroup}
              />
            ))}
          </View>
        </View>
      )}

      {/* Today divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <View style={styles.todayBadge}>
          <Text style={styles.todayText}>Today</Text>
        </View>
        <View style={styles.dividerLine} />
      </View>

      {/* Upcoming */}
      {upcoming.length > 0 ? (
        <View style={styles.card}>
          {upcoming.map((ev, i) => (
            <EventRow
              key={ev.id}
              ev={ev}
              onPress={() => onSelect(ev)}
              isLast={i === upcoming.length - 1}
              showGroup={showGroup}
            />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming events</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 4, marginBottom: 6,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 10, paddingHorizontal: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  todayBadge: {
    paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  todayText: {
    fontSize: 11, fontFamily: Fonts.bold,
    color: Colors.todayRed, letterSpacing: 0.4,
  },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted, fontFamily: Fonts.regular },
});
