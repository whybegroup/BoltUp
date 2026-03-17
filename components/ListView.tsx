import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import { dDiff } from '../utils/helpers';
import { EventRow } from './EventRow';
import type { Event } from '../data/mock';

interface ListViewProps {
  events: Event[];
  onSelect: (ev: Event) => void;
  onSelectGroup?: (groupId: string) => void;
  showGroup?: boolean;
}

type Row =
  | { key: string; type: 'year'; year: number }
  | { key: string; type: 'todayDivider' }
  | { key: string; type: 'upcomingDivider' }
  | { key: string; type: 'event'; event: Event; isPast: boolean };

export function ListView({
  events,
  onSelect,
  onSelectGroup,
  showGroup = true,
}: ListViewProps) {
  const rows: Row[] = useMemo(() => {
    const past: Event[] = [];
    const today: Event[] = [];
    const futureByYear = new Map<number, Event[]>();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    for (const ev of events) {
      const t = ev.start.getTime();
      if (t < todayStart.getTime()) {
        past.push(ev);
      } else if (t >= todayStart.getTime() && t < todayEnd.getTime()) {
        today.push(ev);
      } else {
        const y = ev.start.getFullYear();
        if (!futureByYear.has(y)) futureByYear.set(y, []);
        futureByYear.get(y)!.push(ev);
      }
    }

    // Sort each bucket by start time
    past.sort((a, b) => a.start.getTime() - b.start.getTime());
    today.sort((a, b) => a.start.getTime() - b.start.getTime());
    const futureYears = Array.from(futureByYear.keys()).sort((a, b) => a - b);
    for (const y of futureYears) {
      futureByYear.get(y)!.sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    // Past section (always included when present)
    const pastByYear = past.reduce((acc, ev) => {
      const y = ev.start.getFullYear();
      if (!acc.has(y)) acc.set(y, [] as Event[]);
      acc.get(y)!.push(ev);
      return acc;
    }, new Map<number, Event[]>());

    const r: Row[] = [];

    if (past.length) {
      for (const [year, yearEvents] of Array.from(pastByYear.entries()).sort(
        (a, b) => a[0] - b[0],
      )) {
        r.push({ key: `past-year-${year}`, type: 'year', year });
        for (const ev of yearEvents) {
          r.push({ key: `past-${ev.id}`, type: 'event', event: ev, isPast: true });
        }
      }
    }

    // Today divider
    r.push({ key: 'today-divider', type: 'todayDivider' });

    // Today events
    for (const ev of today) {
      r.push({ key: `today-${ev.id}`, type: 'event', event: ev, isPast: false });
    }

    // Upcoming divider (only if there are future events)
    if (futureYears.length) {
      r.push({ key: 'upcoming-divider', type: 'upcomingDivider' });
    }

    // Upcoming by year, but only show year labels for years after current year
    const currentYear = now.getFullYear();
    for (const year of futureYears) {
      if (year > currentYear) {
        r.push({ key: `future-year-${year}`, type: 'year', year });
      }
      for (const ev of futureByYear.get(year)!) {
        r.push({ key: `future-${ev.id}`, type: 'event', event: ev, isPast: false });
      }
    }

    return r;
  }, [events]);

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'todayDivider') {
      return (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.todayBadge}>
            <Text style={styles.todayText}>Today</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    if (item.type === 'upcomingDivider') {
      return (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingText}>Upcoming</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    if (item.type === 'year') {
      return (
        <View style={styles.yearDivider}>
          <View style={styles.dividerLine} />
          <View style={styles.yearBadge}>
            <Text style={styles.yearText}>{item.year}</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    // event
    return (
      <View style={styles.cardWrapper}>
        <EventRow
          ev={item.event}
          onPress={() => onSelect(item.event)}
          onGroupPress={onSelectGroup}
          isLast={false}
          showGroup={showGroup}
        />
      </View>
    );
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      ListFooterComponent={<View style={{ height: 100 }} />}
    />
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  yearDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  yearBadge: {},
  yearText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  upcomingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  upcomingText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  todayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  todayText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.todayRed,
    letterSpacing: 0.4,
  },
});
