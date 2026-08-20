import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from './AppDateTimePicker';
import { usePathname, type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors, Fonts, Radius } from '../constants/theme';
import {
  getGroupColor,
  getDefaultGroupThemeFromName,
  formatFilterDatetimeTwelveHour,
} from '../utils/helpers';
import { ListView } from './ListView';
import { CalendarView } from './CalendarView';
import { Pill } from './ui';
import Svg, { Path } from 'react-native-svg';
import {
  useEvents,
  useGroups,
  useNotifications,
  useAllGroupMemberColors,
} from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useEventScopeNav } from './eventsScope/EventScopeNavContext';
import {
  loadEventsScreenPrefs,
  saveEventsScreenPrefs,
  parseCalendarFocusIso,
  type EventsScreenPersistedV1,
  type CalendarScopeMode,
} from '../utils/eventsScreenPrefs';
import { type EventDetailed } from '@moijia/client';
import { withReturnTo } from '../utils/navigationReturn';

function formatLocalDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatLocalTimeTwelveHour(d: Date): string {
  const hours24 = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${minutes} ${suffix}`;
}

function webFilterModalInputStyle(): Record<string, string | number> {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #18181B',
    backgroundColor: '#F4F4F5',
    fontSize: 14,
    color: '#18181B',
    fontFamily: 'DMSans_500Medium',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 4,
  };
}

function mergeFilterDraftDatePart(base: Date, picked: Date): Date {
  const n = new Date(base);
  n.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return n;
}

function mergeFilterDraftTimePart(base: Date, picked: Date): Date {
  const n = new Date(base);
  n.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return n;
}

export function EventsListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { viewMode, setViewMode, setFromEventId } = useEventScopeNav();
  const { userId: currentUserId } = useCurrentUserContext();

  // Clear fromEventId when returning to all events
  useEffect(() => {
    setFromEventId(undefined);
  }, [setFromEventId]);

  const { data: events = [], refetch: refetchEvents } = useEvents({
    userId: currentUserId ?? '',
    groupId: undefined,
  });
  const { data: allGroups = [], refetch: refetchGroups } = useGroups(currentUserId ?? '');
  const { refetch: refetchNotifications } = useNotifications(currentUserId || '');
  const { data: groupColors = {}, refetch: refetchGroupColors } = useAllGroupMemberColors(
    currentUserId || ''
  );
  const { refreshControl } = usePullToRefresh([
    refetchEvents,
    refetchGroups,
    refetchNotifications,
    refetchGroupColors,
  ]);
  const groups = allGroups.filter(g => g.membershipStatus === 'member' || g.membershipStatus === 'admin');
  
  // Filter state
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [filterRsvp,  setFilterRsvp]  = useState<string[]>([]);
  const [filterNeeds, setFilterNeeds] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Date range filters (ISO date strings)
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const defaultStartSpecificText = useMemo(() => `${todayIso} 00:00`, [todayIso]);
  const defaultEndSpecificText = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d} 00:00`;
  }, []);
  const [startDateText, setStartDateText] = useState<string>(defaultStartSpecificText);
  const [endDateText,   setEndDateText]   = useState<string>(defaultEndSpecificText);
  const [startMode,     setStartMode]     = useState<'specific' | 'now' | 'allTime'>('now');
  const [endMode,       setEndMode]       = useState<'specific' | 'now' | 'allTime'>('allTime');
  const [datetimeFilterModal, setDatetimeFilterModal] = useState<null | 'start' | 'end'>(null);
  const [filterModalDraft, setFilterModalDraft] = useState(() => new Date());
  const [iosFilterFieldPicker, setIosFilterFieldPicker] = useState<null | 'date' | 'time'>(null);
  const [iosFilterSubDraft, setIosFilterSubDraft] = useState(() => new Date());

  const closeDatetimeFilterModal = () => {
    setIosFilterFieldPicker(null);
    setDatetimeFilterModal(null);
  };

  const RSVP_OPTIONS = [
    ['going', 'Going'],
    ['maybe', 'Maybe'],
    ['notGoing', "Can't go"],
    ['none', 'No response'],
  ] as const;

  const parseDateTime = (txt: string): Date | null => {
    const t = txt.trim();
    if (!t) return null;
    const [datePart, timePart] = t.split(' ');
    const parts = datePart.split('-');
    if (parts.length !== 3) return null;
    const [ys, ms, ds] = parts;
    const y = Number(ys);
    const m = Number(ms);
    const d = Number(ds);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    let hh = 0;
    let mm = 0;
    if (timePart) {
      const [hs, mins] = timePart.split(':');
      hh = Number(hs) || 0;
      mm = Number(mins) || 0;
    }
    const dt = new Date(y, m - 1, d, hh, mm);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  };
  const [calendarScopeMode, setCalendarScopeMode] = useState<CalendarScopeMode>('week');
  const [calendarFocusDate, setCalendarFocusDate] = useState(() => new Date());
  const [calendarBodyScrollY, setCalendarBodyScrollY] = useState<
    Partial<Record<CalendarScopeMode, number>>
  >({});
  const [calendarYearMonthStrip, setCalendarYearMonthStrip] = useState<
    { year: number; x: number } | undefined
  >(undefined);
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const partial = await loadEventsScreenPrefs();
      if (cancelled) return;
      if (partial) {
        if (partial.viewMode) setViewMode(partial.viewMode);
        if (partial.calendarScopeMode) setCalendarScopeMode(partial.calendarScopeMode);
        if (partial.calendarFocusIso !== undefined) {
          setCalendarFocusDate(parseCalendarFocusIso(partial.calendarFocusIso));
        }
        if (partial.calendarBodyScrollY) setCalendarBodyScrollY(partial.calendarBodyScrollY);
        if (partial.calendarYearMonthStrip) setCalendarYearMonthStrip(partial.calendarYearMonthStrip);
        if (partial.selectedGroupIds !== undefined) setSelectedGroupIds(partial.selectedGroupIds);
        if (partial.filterRsvp !== undefined) setFilterRsvp(partial.filterRsvp);
        if (partial.filterNeeds !== undefined) setFilterNeeds(partial.filterNeeds);
        if (partial.showAdvancedFilters !== undefined) setShowAdvancedFilters(partial.showAdvancedFilters);
        if (partial.startDateText) setStartDateText(partial.startDateText);
        if (partial.endDateText) setEndDateText(partial.endDateText);
        if (partial.startMode) setStartMode(partial.startMode);
        if (partial.endMode) setEndMode(partial.endMode);
      }
      if (!cancelled) setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [setViewMode]);

  useEffect(() => {
    if (!prefsReady) return;
    const payload: EventsScreenPersistedV1 = {
      v: 1,
      viewMode,
      calendarScopeMode,
      calendarFocusIso: calendarFocusDate.toISOString(),
      calendarBodyScrollY: Object.keys(calendarBodyScrollY).length ? calendarBodyScrollY : undefined,
      calendarYearMonthStrip,
      selectedGroupIds,
      filterRsvp,
      filterNeeds,
      showAdvancedFilters,
      startDateText,
      endDateText,
      startMode,
      endMode,
    };
    void saveEventsScreenPrefs(payload);
  }, [
    prefsReady,
    viewMode,
    calendarScopeMode,
    calendarFocusDate,
    calendarBodyScrollY,
    calendarYearMonthStrip,
    selectedGroupIds,
    filterRsvp,
    filterNeeds,
    showAdvancedFilters,
    startDateText,
    endDateText,
    startMode,
    endMode,
  ]);

  const onCalendarBodyScrollYCommit = useCallback((mode: CalendarScopeMode, y: number) => {
    setCalendarBodyScrollY((prev) => ({ ...prev, [mode]: y }));
  }, []);

  const onCalendarYearMonthStripCommit = useCallback((payload: { year: number; x: number }) => {
    setCalendarYearMonthStrip(payload);
  }, []);

  const filtered = useMemo(() => {
    const parseBound = (txt: string): Date | null => {
      const t = txt.trim();
      if (!t) return null;
      const [datePart, timePart] = t.split(' ');
      const parts = datePart.split('-');
      if (parts.length !== 3) return null;
      const [ys, ms, ds] = parts;
      const y = Number(ys);
      const m = Number(ms);
      const d = Number(ds);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
      let hh = 0;
      let mm = 0;
      if (timePart) {
        const [hs, mins] = timePart.split(':');
        hh = Number(hs) || 0;
        mm = Number(mins) || 0;
      }
      const dt = new Date(y, m - 1, d, hh, mm);
      if (Number.isNaN(dt.getTime())) return null;
      return dt;
    };

    const startBound =
      startMode === 'now'
        ? new Date()
        : startMode === 'specific'
          ? (parseBound(startDateText) ?? null)
          : null; // allTime → no lower bound

    const endBound =
      endMode === 'now'
        ? new Date()
        : endMode === 'specific'
          ? parseBound(endDateText)
          : null; // allTime → no upper bound

    /** Date picker default is 00:00 — treat as “through that calendar day”, not “before midnight”. */
    const inclusiveEndCutoff = (b: Date): Date => {
      if (
        b.getHours() === 0 &&
        b.getMinutes() === 0 &&
        b.getSeconds() === 0 &&
        b.getMilliseconds() === 0
      ) {
        return new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999);
      }
      return b;
    };

    const endFilterCutoff = endBound != null ? inclusiveEndCutoff(endBound) : null;

    return events.filter(ev => {
      if (!groups.some(g => g.id === ev.groupId)) return false;
      if (selectedGroupIds.length > 0 && !selectedGroupIds.includes(ev.groupId)) return false;

      const evStart = typeof ev.start === 'string' ? new Date(ev.start) : ev.start;
      const evEnd = typeof ev.end === 'string' ? new Date(ev.end) : ev.end;
      
      // Use end time for start bound (so ongoing events show up)
      if (startBound && evEnd.getTime() <= startBound.getTime()) return false;
      // Inclusive end: hide only when start is after the cutoff instant
      if (endFilterCutoff && evStart.getTime() > endFilterCutoff.getTime()) return false;

      const rsvps = ev.rsvps || [];
      const myGoing    = !!rsvps.find(r => r.userId === currentUserId && r.status === 'going');
      const myNotGoing = !!rsvps.find(r => r.userId === currentUserId && r.status === 'notGoing');
      const myAnyRsvp  = !!rsvps.find(r => r.userId === currentUserId);

      if (filterRsvp.length) {
        const myMaybe = !!rsvps.find(r => r.userId === currentUserId && r.status === 'maybe');
        const matchesRsvp =
          (filterRsvp.includes('going')    && myGoing) ||
          (filterRsvp.includes('maybe')    && myMaybe) ||
          (filterRsvp.includes('notGoing') && myNotGoing) ||
          (filterRsvp.includes('none')     && !myAnyRsvp);
        if (!matchesRsvp) return false;
      }

      if (filterNeeds && !(ev.minAttendees && rsvps.filter(r => r.status === 'going').length < ev.minAttendees)) return false;
      return true;
    });
  }, [
    groups,
    selectedGroupIds,
    filterRsvp,
    filterNeeds,
    startDateText,
    endDateText,
    startMode,
    endMode,
    events,
    currentUserId,
  ]);

  const hasFilters = !!(selectedGroupIds.length || filterRsvp.length || filterNeeds);

  return (
    <View style={styles.safe}>
      {/* Filters container */}
      <View style={styles.filtersContainer}>
        {/* Group filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ gap: 6, paddingRight: 20 }}>
          <Pill
            label="All"
            selected={selectedGroupIds.length === 0}
            onPress={() => setSelectedGroupIds([])}
          />
          {groups.map(g => {
            const userColorHex = groupColors[g.id] || getDefaultGroupThemeFromName(g.name);
            const p = getGroupColor(userColorHex);
            const isSelected = selectedGroupIds.includes(g.id);
            return (
              <Pill
                key={g.id}
                label={g.name}
                selected={isSelected}
                activeColor={p.dot}
                activeBg={p.label}
                activeText={p.text}
                inactiveBorderColor={p.dot}
                onPress={() => {
                  const next = isSelected
                    ? selectedGroupIds.filter(id => id !== g.id)
                    : [...selectedGroupIds, g.id];
                  setSelectedGroupIds(next);
                }}
                onLongPress={() => setSelectedGroupIds([g.id])}
              />
            );
          })}
        </ScrollView>

        {/* RSVP / needs filters (always visible) */}
        <View style={[styles.filterPanel, { position: 'relative' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingVertical: 8 }}
          >
            <TouchableOpacity
              onPress={() => setShowAdvancedFilters(p => !p)}
              style={[styles.filterIconBtn, showAdvancedFilters && { borderColor: Colors.text, backgroundColor: Colors.text }]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={showAdvancedFilters ? Colors.surface : Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </Svg>
            </TouchableOpacity>
            <Pill
              label="Needs people"
              leading={
                <Ionicons
                  name="warning-outline"
                  size={14}
                  color={filterNeeds ? '#92400E' : Colors.textSub}
                />
              }
              selected={filterNeeds}
              onPress={() => setFilterNeeds(p => !p)}
              activeColor="#FDE68A"
              activeBg="#FFFBEB"
              activeText="#92400E"
            />
          </ScrollView>

          {showAdvancedFilters && (
            <>
            <View style={styles.filterExpandedRow}>
              <Text style={styles.filterExpandedHeader}>RSVP</Text>
              {RSVP_OPTIONS.map(([v, label]) => {
                const isSelected = filterRsvp.includes(v);
                const pillStyle =
                  v === 'going'
                    ? (isSelected ? styles.rsvpPillGoingActive : styles.rsvpPillGoing)
                    : v === 'maybe'
                      ? (isSelected ? styles.rsvpPillMaybeActive : styles.rsvpPillMaybe)
                      : v === 'notGoing'
                        ? (isSelected ? styles.rsvpPillNotGoingActive : styles.rsvpPillNotGoing)
                        : (isSelected ? styles.rsvpPillNoneActive : styles.rsvpPillNone);

                return (
                  <TouchableOpacity
                    key={v}
                    style={[styles.rsvpDropdownItem, pillStyle]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setFilterRsvp(isSelected ? [] : [v]);
                    }}
                  >
                    <Text style={styles.rsvpDropdownLabel}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterExpandedRow}>
              <Text style={styles.filterExpandedHeader}>Time Range</Text>
              <View style={styles.dateFilterColumn}>
                <View style={styles.dateFilterRow}>
                  <Text style={styles.dateFilterFieldLabel}>From</Text>
                  <View style={styles.dateFieldWithNow}>
                    <TouchableOpacity
                      style={[
                        styles.dateQuickButton,
                        startMode === 'now' && styles.dateQuickButtonActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setStartMode('now');
                      }}
                    >
                      <Text style={styles.dateQuickButtonText}>Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dateQuickButton,
                        startMode === 'allTime' && styles.dateQuickButtonActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setStartMode('allTime');
                      }}
                    >
                      <Text style={styles.dateQuickButtonText}>All time</Text>
                    </TouchableOpacity>
                    <View style={[styles.nativeDateFieldWrap, styles.filterDatetimeSlot]} collapsable={false}>
                      <TouchableOpacity
                        onPress={() => {
                          let text = startDateText;
                          if (!text) {
                            const now = new Date();
                            const y = now.getFullYear();
                            const m = String(now.getMonth() + 1).padStart(2, '0');
                            const d = String(now.getDate()).padStart(2, '0');
                            text = `${y}-${m}-${d} 00:00`;
                            setStartDateText(text);
                          }
                          setFilterModalDraft(parseDateTime(text) ?? new Date());
                          setDatetimeFilterModal('start');
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.dateValueChip,
                          startMode === 'specific' && styles.dateSpecificWrapperActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateValueText,
                            startMode === 'specific' && styles.dateValueTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {formatFilterDatetimeTwelveHour(
                            startDateText || defaultStartSpecificText
                          )}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <View style={styles.dateFilterRow}>
                  <Text style={styles.dateFilterFieldLabel}>To</Text>
                  <View style={styles.dateFieldWithNow}>
                    <TouchableOpacity
                      style={[
                        styles.dateQuickButton,
                        endMode === 'now' && styles.dateQuickButtonActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setEndMode('now');
                      }}
                    >
                      <Text style={styles.dateQuickButtonText}>Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dateQuickButton,
                        endMode === 'allTime' && styles.dateQuickButtonActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setEndMode('allTime');
                      }}
                    >
                      <Text style={styles.dateQuickButtonText}>All time</Text>
                    </TouchableOpacity>
                    <View style={[styles.nativeDateFieldWrap, styles.filterDatetimeSlot]} collapsable={false}>
                      <TouchableOpacity
                        onPress={() => {
                          let text = endDateText;
                          if (!text) {
                            const now = new Date();
                            const y = now.getFullYear();
                            const m = String(now.getMonth() + 1).padStart(2, '0');
                            const d = String(now.getDate()).padStart(2, '0');
                            text = `${y}-${m}-${d} 00:00`;
                            setEndDateText(text);
                          }
                          setFilterModalDraft(parseDateTime(text) ?? new Date());
                          setDatetimeFilterModal('end');
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.dateValueChip,
                          endMode === 'specific' && styles.dateSpecificWrapperActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateValueText,
                            endMode === 'specific' && styles.dateValueTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {formatFilterDatetimeTwelveHour(
                            endDateText || defaultEndSpecificText
                          )}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
            </>
          )}
        </View>
      </View>

      {/* Events */}
      <View style={styles.eventsContent}>
        {viewMode === 'list' ? (
          filtered.length === 0 ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.emptyState}
              refreshControl={refreshControl}
            >
              <Ionicons name="calendar-outline" size={56} color={Colors.textMuted} style={styles.emptyGlyph} />
              <Text style={styles.emptyTitle}>No events</Text>
              <Text style={styles.emptyDesc}>
                {hasFilters ? 'Try adjusting your filters' : 'Create an event to get started'}
              </Text>
            </ScrollView>
          ) : (
            <ListView
              events={filtered}
              groups={groups}
              groupColors={groupColors}
              refreshControl={refreshControl}
              onSelect={(ev) =>
                router.push(`/(tabs)/events/${(ev as EventDetailed).id}` as Href)
              }
              onSelectGroup={(groupId) =>
                router.push(withReturnTo(`/(tabs)/groups/${groupId}`, pathname))
              }
            />
          )
        ) : (
          <CalendarView
            events={filtered}
            filterRsvp={filterRsvp}
            groups={groups}
            groupColors={groupColors}
            refreshControl={refreshControl}
            onSelectEvent={(ev) =>
              router.push(`/(tabs)/events/${(ev as EventDetailed).id}` as Href)
            }
            onSelectGroup={(groupId) =>
              router.push(withReturnTo(`/(tabs)/groups/${groupId}`, pathname))
            }
            calendarFocusDate={calendarFocusDate}
            onCalendarFocusDateChange={setCalendarFocusDate}
            calendarScopeMode={calendarScopeMode}
            onCalendarScopeModeChange={setCalendarScopeMode}
            calendarBodyScrollY={calendarBodyScrollY}
            onCalendarBodyScrollYCommit={onCalendarBodyScrollYCommit}
            calendarYearMonthStrip={calendarYearMonthStrip}
            onCalendarYearMonthStripCommit={onCalendarYearMonthStripCommit}
            calendarScrollPrefsReady={prefsReady}
          />
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={datetimeFilterModal != null}
        onRequestClose={() => {
          if (Platform.OS === 'ios' && iosFilterFieldPicker != null) {
            setIosFilterFieldPicker(null);
          } else {
            closeDatetimeFilterModal();
          }
        }}
        statusBarTranslucent
      >
        <View style={styles.filterDatetimeModalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.iosFilterPickerBackdrop]}
            onPress={() => {
              if (Platform.OS === 'ios' && iosFilterFieldPicker != null) {
                setIosFilterFieldPicker(null);
              } else {
                closeDatetimeFilterModal();
              }
            }}
          />
          <View style={styles.filterDatetimeModalCard} pointerEvents="box-none">
            {Platform.OS === 'ios' && iosFilterFieldPicker != null ? (
              <>
                <View style={styles.filterIosSubPickerHeader}>
                  <TouchableOpacity
                    onPress={() => setIosFilterFieldPicker(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.filterIosSubPickerBack}
                  >
                    <Ionicons name="chevron-back" size={22} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.filterIosSubPickerTitle}>
                    {iosFilterFieldPicker === 'date' ? 'Date' : 'Time'}
                  </Text>
                </View>
                <View
                  style={
                    iosFilterFieldPicker === 'date'
                      ? styles.filterIosSubPickerHostCalendar
                      : styles.filterIosSubPickerHostTime
                  }
                >
                  <DateTimePicker
                    value={iosFilterSubDraft}
                    mode={iosFilterFieldPicker}
                    display={iosFilterFieldPicker === 'date' ? 'inline' : 'spinner'}
                    locale="en-US"
                    onChange={(_, date) => {
                      if (date) setIosFilterSubDraft(date);
                    }}
                    style={
                      iosFilterFieldPicker === 'date'
                        ? styles.filterIosSubPickerCalendar
                        : styles.filterIosSubPickerTimeWheels
                    }
                  />
                </View>
                <TouchableOpacity
                  style={[styles.filterDatetimeModalSave, styles.filterIosSubPickerDone]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (iosFilterFieldPicker === 'date') {
                      setFilterModalDraft((prev) => mergeFilterDraftDatePart(prev, iosFilterSubDraft));
                    } else {
                      setFilterModalDraft((prev) => mergeFilterDraftTimePart(prev, iosFilterSubDraft));
                    }
                    setIosFilterFieldPicker(null);
                  }}
                >
                  <Text style={styles.filterDatetimeModalSaveText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.filterDatetimeModalTitle}>
                  {datetimeFilterModal === 'start' ? 'From' : datetimeFilterModal === 'end' ? 'To' : ''}
                </Text>
                <ScrollView
                  style={styles.filterDatetimeModalScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.filterModalSectionLabel}>Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={
                        datetimeFilterModal
                          ? formatLocalDateTime(filterModalDraft).slice(0, 10)
                          : ''
                      }
                      onChange={(e: any) => {
                        const datePart = String(e?.target?.value || '').trim();
                        if (!datePart || !datetimeFilterModal) return;
                        const [y, m, d] = datePart.split('-').map(Number);
                        if (!y || !m || !d) return;
                        setFilterModalDraft((prev) =>
                          mergeFilterDraftDatePart(prev, new Date(y, m - 1, d, 12, 0))
                        );
                      }}
                      style={webFilterModalInputStyle()}
                    />
                  ) : Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      style={styles.filterModalIosField}
                      activeOpacity={0.75}
                      onPress={() => {
                        setIosFilterSubDraft(new Date(filterModalDraft));
                        setIosFilterFieldPicker('date');
                      }}
                    >
                      <Text style={styles.filterModalIosFieldText}>
                        {formatLocalDateTime(filterModalDraft).slice(0, 10)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <DateTimePicker
                      value={filterModalDraft}
                      mode="date"
                      display="spinner"
                      locale="en-US"
                      onChange={(_, date) => {
                        if (date) setFilterModalDraft((prev) => mergeFilterDraftDatePart(prev, date));
                      }}
                      style={styles.inlinePicker}
                    />
                  )}
                  <Text style={styles.filterModalSectionLabel}>Time</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="time"
                      value={(() => {
                        const t = formatLocalDateTime(filterModalDraft).split(' ')[1] ?? '00:00';
                        return t.length === 5 ? t : '00:00';
                      })()}
                      onChange={(e: any) => {
                        const timePart = String(e?.target?.value || '').trim();
                        if (!timePart || !datetimeFilterModal) return;
                        const [hs, mins] = timePart.split(':');
                        const hh = Number(hs) || 0;
                        const mm = Number(mins) || 0;
                        setFilterModalDraft((prev) => {
                          const n = new Date(prev);
                          n.setHours(hh, mm, 0, 0);
                          return n;
                        });
                      }}
                      style={webFilterModalInputStyle()}
                    />
                  ) : Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      style={styles.filterModalIosField}
                      activeOpacity={0.75}
                      onPress={() => {
                        setIosFilterSubDraft(new Date(filterModalDraft));
                        setIosFilterFieldPicker('time');
                      }}
                    >
                      <Text style={styles.filterModalIosFieldText}>
                        {formatLocalTimeTwelveHour(filterModalDraft)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <DateTimePicker
                      value={filterModalDraft}
                      mode="time"
                      display="spinner"
                      is24Hour={false}
                      locale="en-US"
                      onChange={(_, date) => {
                        if (date) setFilterModalDraft((prev) => mergeFilterDraftTimePart(prev, date));
                      }}
                      style={styles.inlinePicker}
                    />
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={styles.filterDatetimeModalSave}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (datetimeFilterModal === 'start') {
                      setStartDateText(formatLocalDateTime(filterModalDraft));
                      setStartMode('specific');
                    } else if (datetimeFilterModal === 'end') {
                      setEndDateText(formatLocalDateTime(filterModalDraft));
                      setEndMode('specific');
                    }
                    closeDatetimeFilterModal();
                  }}
                >
                  <Text style={styles.filterDatetimeModalSaveText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  filtersContainer: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  viewToggle:  {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 36,
    minWidth: 118,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  viewBtn:     {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  viewToggleSegLeft: { borderTopLeftRadius: 9, borderBottomLeftRadius: 9 },
  viewToggleSegRight: { borderTopRightRadius: 9, borderBottomRightRadius: 9 },
  viewBtnActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  iconBtn:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive:{ backgroundColor: Colors.bg, borderColor: Colors.accent },
  bellDot:     { position: 'absolute', top: 1, right: 1, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.notGoing, borderWidth: 2, borderColor: Colors.surface },
  pillsRow:    { flexGrow: 0, paddingLeft: 20, paddingVertical: 8 },
  eventsContent: { flex: 1, paddingHorizontal: 16, paddingTop: 8, zIndex: 0 },
  filterIconBtn:{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  dateFilterBetween: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 220,
  },
  dateFilterColumn: {
    marginTop: 4,
    gap: 6,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  dateFilterLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  dateFilterInput: {
    minWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  dateFilterSeparator: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  dateFilterButtonActive: {
    borderColor: Colors.accent,
  },
  dateFilterButtonText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  dateFilterButtonTextActive: {
    color: Colors.text,
  },
  dateOverlay: {
    flex: 1,
  },
  dateTooltip: {
    position: 'absolute',
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 200,
    elevation: 200,
  },
  dateClickAwayHitbox: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'transparent',
  },
  dateFilterFieldLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
    minWidth: 40, // align "From" / "To" columns
  },
  filterDatetimeSlot: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 0,
  },
  dateValueChip: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dateValueText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
    textAlign: 'left',
  },
  dateValueTextActive: {
    color: Colors.text,
  },
  dateFieldWithNow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0,
  },
  nativeDateFieldWrap: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 6 },
  inlinePicker: { alignSelf: 'flex-start' },
  iosFilterPickerBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  filterDatetimeModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  filterDatetimeModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 2,
  },
  filterDatetimeModalTitle: {
    fontSize: 17,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginBottom: 12,
  },
  filterModalSectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
  },
  filterDatetimeModalScroll: {
    maxHeight: 420,
  },
  filterDatetimeModalSave: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  filterDatetimeModalSaveText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.surface,
  },
  filterModalIosField: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#18181B',
    backgroundColor: Colors.bg,
    marginBottom: 4,
  },
  filterModalIosFieldText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  filterIosSubPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 0,
  },
  filterIosSubPickerTitle: {
    fontSize: 17,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginBottom: 0,
    flex: 1,
  },
  filterIosSubPickerBack: {
    paddingVertical: 4,
    paddingRight: 4,
    marginLeft: -4,
  },
  /** Equal padding on all sides; calendar centered (intrinsic width) within the inset. */
  filterIosSubPickerHostCalendar: {
    width: '100%',
    minHeight: 320,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  filterIosSubPickerHostTime: {
    width: '100%',
    minHeight: 200,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
    overflow: 'visible',
  },
  filterIosSubPickerCalendar: {
    alignSelf: 'center',
  },
  filterIosSubPickerTimeWheels: {
    width: '100%',
    alignSelf: 'stretch',
  },
  filterIosSubPickerDone: {
    marginTop: 4,
  },
  dateQuickButton: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateQuickButtonText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  dateQuickButtonActive: {
    backgroundColor: Colors.bg,
    borderColor: Colors.accent,
  },
  dateSpecificWrapperActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
  pastToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 6,
    marginTop: 4,
  },
  pastDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  pastBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pastBadgeActive: {
    borderColor: Colors.textSub,
    backgroundColor: Colors.bg,
  },
  pastBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pastBadgeTextActive: {
    color: Colors.textSub,
  },
  rsvpFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rsvpFilterButtonText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  rsvpFilterChevron: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  filterExpandedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.bg,
  },
  filterExpandedHeader: {
    width: '100%',
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rsvpDropdownItem: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  rsvpDropdownLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  rsvpPillGoing: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  rsvpPillGoingActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
  rsvpPillMaybe: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  rsvpPillMaybeActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
  rsvpPillNotGoing: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  rsvpPillNotGoingActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
  rsvpPillNone: {
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  rsvpPillNoneActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
  filterPanel: { paddingBottom: 6 },
  filterSectionLabel:{ fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted, letterSpacing: 0.6, marginBottom: 8 },
  emptyState:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyGlyph:  { marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8 },
  emptyDesc:   { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyBtn:    { paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.accent },
  emptyBtnText:{ fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.accentFg },
});
