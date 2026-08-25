import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { Sheet } from './ui';
import { useEvents } from '../hooks/api';
import { shareEvent, shareFromModal } from '../utils/shareContent';
import {
  addEventToDeviceCalendar,
  detailsForCalendarExportScope,
  isRepeatingCalendarEvent,
  openEventInGoogleCalendar,
  saveEventCalendarFile,
  type CalendarExportScope,
  type EventCalendarDetails,
} from '../utils/eventCalendarExport';

type CalendarExportKind = 'google' | 'apple' | 'save';

type Props = {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  groupId?: string | null;
  userId?: string | null;
  details: EventCalendarDetails;
};

const SCOPE_OPTIONS: { key: CalendarExportScope; title: string; sub: string }[] = [
  { key: 'this', title: 'Just this event', sub: 'Only this date' },
  { key: 'future', title: 'All future events', sub: 'This date and later ones in the series' },
];

function isAppleDevice(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(`${navigator.platform} ${navigator.userAgent}`);
}

function toStartDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function EventShareSheet({ visible, onClose, eventId, groupId, userId, details }: Props) {
  const showAppleCalendar = isAppleDevice();
  const repeating = isRepeatingCalendarEvent(details);
  const seriesId = (details.recurrenceSeriesId ?? '').trim();
  const [pendingExport, setPendingExport] = useState<CalendarExportKind | null>(null);

  const range = useMemo(() => {
    const now = Date.now();
    return {
      startAfter: new Date(now - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      startBefore: new Date(now + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }, []);

  const seriesQuery = useEvents({
    userId: userId ?? '',
    groupId: groupId ?? undefined,
    startAfter: range.startAfter,
    startBefore: range.startBefore,
    limit: 500,
    enabled: visible && repeating && !!userId && !!groupId,
  });

  const seriesStarts = useMemo(() => {
    const starts: Date[] = [];
    for (const ev of seriesQuery.data ?? []) {
      if (!seriesId || (ev.recurrenceSeriesId ?? '').trim() !== seriesId) continue;
      const d = toStartDate(ev.start as Date | string);
      if (d) starts.push(d);
    }
    const current = toStartDate(details.start);
    if (current && !starts.some((d) => Math.abs(d.getTime() - current.getTime()) <= 1000)) {
      starts.push(current);
    }
    return starts.sort((a, b) => a.getTime() - b.getTime());
  }, [seriesQuery.data, seriesId, details.start]);

  useEffect(() => {
    if (!visible) setPendingExport(null);
  }, [visible]);

  const saveLabel = Platform.OS === 'web' ? 'Download calendar file' : 'Save calendar file';
  const saveDesc =
    Platform.OS === 'android'
      ? 'Save a .ics file or open it in a calendar app'
      : 'Save a .ics file on this device';

  const exportTitle =
    pendingExport === 'google'
      ? 'Google Calendar'
      : pendingExport === 'apple'
        ? 'Apple Calendar'
        : pendingExport === 'save'
          ? saveLabel
          : '';

  const runCalendarExport = (kind: CalendarExportKind, scoped: EventCalendarDetails) => {
    shareFromModal(onClose, () => {
      if (kind === 'google') return openEventInGoogleCalendar(eventId, scoped);
      if (kind === 'apple') return addEventToDeviceCalendar(eventId, scoped);
      return saveEventCalendarFile(eventId, scoped);
    });
  };

  const onCalendarPress = (kind: CalendarExportKind) => {
    if (repeating) {
      setPendingExport(kind);
      return;
    }
    runCalendarExport(kind, details);
  };

  const onScopePress = (scope: CalendarExportScope) => {
    if (!pendingExport) return;
    runCalendarExport(pendingExport, detailsForCalendarExportScope(details, scope, seriesStarts));
  };

  return (
    <Sheet visible={visible} onClose={onClose} variant="dark" dimBackdrop={false} dragToDismiss>
      {pendingExport ? (
        <>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setPendingExport(null)}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={22} color="#d4d4d8" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {exportTitle}
              </Text>
              <Text style={styles.headerSub}>Which dates do you want to add?</Text>
            </View>
          </View>
          {seriesQuery.isLoading && repeating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#d4d4d8" />
            </View>
          ) : null}
          {SCOPE_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.row, i === SCOPE_OPTIONS.length - 1 && styles.rowLast]}
              onPress={() => onScopePress(opt.key)}
              disabled={repeating && seriesQuery.isLoading}
              accessibilityRole="button"
              accessibilityLabel={opt.title}
            >
              <Ionicons
                name={opt.key === 'this' ? 'calendar-outline' : 'arrow-forward-circle-outline'}
                size={22}
                color="#d4d4d8"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{opt.title}</Text>
                <Text style={styles.rowDesc}>{opt.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="calendar-outline" size={22} color="#f5f5f7" />
            </View>
            <Text style={styles.title} numberOfLines={2}>
              Share {details.name.trim() || 'event'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              shareFromModal(onClose, () =>
                shareEvent(eventId, {
                  name: details.name,
                  start: details.start,
                  end: details.end,
                  isAllDay: details.isAllDay,
                  location: details.location,
                  locationName: details.locationName,
                  locationAddress: details.locationAddress,
                  groupName: details.groupName,
                }),
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Share link"
          >
            <Ionicons name="share-outline" size={22} color="#d4d4d8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Share link</Text>
              <Text style={styles.rowDesc}>Send a link to this event</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => onCalendarPress('google')}
            accessibilityRole="button"
            accessibilityLabel="Add to Google Calendar"
          >
            <Ionicons name="logo-google" size={22} color="#d4d4d8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Google Calendar</Text>
              <Text style={styles.rowDesc}>Add this event in Google Calendar</Text>
            </View>
          </TouchableOpacity>
          {showAppleCalendar ? (
            <TouchableOpacity
              style={styles.row}
              onPress={() => onCalendarPress('apple')}
              accessibilityRole="button"
              accessibilityLabel="Add to Apple Calendar"
            >
              <Ionicons name="logo-apple" size={22} color="#d4d4d8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Apple Calendar</Text>
                <Text style={styles.rowDesc}>Opens Calendar with this event</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => onCalendarPress('save')}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
          >
            <Ionicons name="download-outline" size={22} color="#d4d4d8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{saveLabel}</Text>
              <Text style={styles.rowDesc}>{saveDesc}</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    marginTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.regular,
    color: '#f5f5f7',
  },
  headerSub: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.55)',
  },
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: 15, fontFamily: Fonts.medium, color: '#f5f5f7' },
  rowDesc: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
});
