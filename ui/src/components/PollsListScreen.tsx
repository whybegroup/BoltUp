import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import type { Poll } from '@moijia/client';
import { Colors, Fonts, Layout, Radius } from '../constants/theme';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import {
  useAllGroupMemberColors,
  useGroups,
  useNotifications,
  usePolls,
} from '../hooks/api';
import { getDefaultGroupThemeFromName, getGroupColor } from '../utils/helpers';
import { withReturnTo } from '../utils/navigationReturn';
import { loadPollsScreenPrefs, savePollsScreenPrefs } from '../utils/pollsScreenPrefs';
import { CreateOrJoinButton } from './CreateOrJoinButton';
import { Pill } from './ui';
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { PollRow, getDeadlineUrgency } from './PollRow';
import Svg, { Path } from 'react-native-svg';

let WebDatePicker: any = null;
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebDatePicker = require('react-datepicker').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('react-datepicker/dist/react-datepicker.css');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../app/(tabs)/react-datepicker-overrides.css');
}

function deadlineForPoll(poll: Poll): Date | null {
  if ((poll as Poll & { deadline?: string | null }).deadline) {
    const direct = new Date((poll as Poll & { deadline?: string | null }).deadline as string);
    if (Number.isFinite(direct.getTime())) return direct;
  }
  let minTs = Number.POSITIVE_INFINITY;
  for (const option of poll.options) {
    if (option.inputKind !== 'datetime' || !option.dateTimeValue) continue;
    const ts = new Date(option.dateTimeValue).getTime();
    if (Number.isFinite(ts) && ts < minTs) minTs = ts;
  }
  return Number.isFinite(minTs) ? new Date(minTs) : null;
}

export type PollsListScreenProps = {
  /** When set, filters to this group only and hides group pills; does not overwrite saved tab group selection. */
  lockedGroupId?: string;
  /** Omit tab header / notifications (parent provides Groups chrome). */
  embedded?: boolean;
};

export function PollsListScreen({ lockedGroupId, embedded }: PollsListScreenProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId: currentUserId } = useCurrentUserContext();
  const { data: polls = [] } = usePolls(currentUserId ?? '');
  const { data: allGroups = [] } = useGroups(currentUserId ?? '');
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId ?? '');
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    lockedGroupId ? [lockedGroupId] : []
  );

  useEffect(() => {
    if (lockedGroupId) setSelectedGroupIds([lockedGroupId]);
  }, [lockedGroupId]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);

  const groups = useMemo(
    () =>
      allGroups.filter(
        (g) =>
          g.membershipStatus === 'member' ||
          g.membershipStatus === 'admin' ||
          g.membershipStatus === 'pending'
      ),
    [allGroups]
  );
  const groupsById = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g] as const)),
    [groups]
  );
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
  const [endDateText, setEndDateText] = useState<string>(defaultEndSpecificText);
  const [startMode, setStartMode] = useState<'specific' | 'now' | 'allTime'>('now');
  const [endMode, setEndMode] = useState<'specific' | 'now' | 'allTime'>('allTime');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const prefs = await loadPollsScreenPrefs();
      if (!mounted || !prefs) return;
      if (!lockedGroupId && prefs.selectedGroupIds) setSelectedGroupIds(prefs.selectedGroupIds);
      if (prefs.showAdvancedFilters !== undefined) setShowAdvancedFilters(prefs.showAdvancedFilters);
      if (prefs.startDateText) setStartDateText(prefs.startDateText);
      if (prefs.endDateText) setEndDateText(prefs.endDateText);
      if (prefs.startMode) setStartMode(prefs.startMode);
      if (prefs.endMode) setEndMode(prefs.endMode);
    })();
    return () => {
      mounted = false;
    };
  }, [lockedGroupId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prev = lockedGroupId ? await loadPollsScreenPrefs() : null;
      if (cancelled) return;
      void savePollsScreenPrefs({
        v: 1,
        selectedGroupIds: lockedGroupId ? (prev?.selectedGroupIds ?? []) : selectedGroupIds,
        showAdvancedFilters,
        startDateText,
        endDateText,
        startMode,
        endMode,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    lockedGroupId,
    selectedGroupIds,
    showAdvancedFilters,
    startDateText,
    endDateText,
    startMode,
    endMode,
  ]);

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

  const filteredPolls = useMemo(() => {
    const startBound =
      startMode === 'now'
        ? new Date()
        : startMode === 'specific'
          ? parseDateTime(startDateText)
          : null;
    const endBound =
      endMode === 'now'
        ? new Date()
        : endMode === 'specific'
          ? parseDateTime(endDateText)
          : null;
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
    const endFilterCutoff = endBound ? inclusiveEndCutoff(endBound) : null;

    return polls.filter((poll) => {
      if (lockedGroupId && poll.groupId !== lockedGroupId) return false;
      if (!groups.some((g) => g.id === poll.groupId)) return false;
      if (selectedGroupIds.length > 0 && !selectedGroupIds.includes(poll.groupId)) return false;
      const deadline = deadlineForPoll(poll);
      if (!deadline) return true;
      if (startBound && deadline.getTime() <= startBound.getTime()) return false;
      if (endFilterCutoff && deadline.getTime() > endFilterCutoff.getTime()) return false;
      return true;
    });
  }, [
    polls,
    groups,
    lockedGroupId,
    selectedGroupIds,
    startMode,
    endMode,
    startDateText,
    endDateText,
  ]);
  /** Soonest deadline first; polls with no deadline sort last. */
  const sortedPolls = useMemo(() => {
    return [...filteredPolls].sort((a, b) => {
      const aDeadline = deadlineForPoll(a)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDeadline = deadlineForPoll(b)?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;

      const aClosedAt = new Date((a as Poll & { closedAt?: string | null }).closedAt ?? '').getTime();
      const bClosedAt = new Date((b as Poll & { closedAt?: string | null }).closedAt ?? '').getTime();
      const aClosedSort = Number.isFinite(aClosedAt) ? aClosedAt : Number.POSITIVE_INFINITY;
      const bClosedSort = Number.isFinite(bClosedAt) ? bClosedAt : Number.POSITIVE_INFINITY;
      if (aClosedSort !== bClosedSort) return aClosedSort - bClosedSort;

      const aCreatedAt = new Date(a.createdAt).getTime();
      const bCreatedAt = new Date(b.createdAt).getTime();
      const aCreatedSort = Number.isFinite(aCreatedAt) ? aCreatedAt : Number.POSITIVE_INFINITY;
      const bCreatedSort = Number.isFinite(bCreatedAt) ? bCreatedAt : Number.POSITIVE_INFINITY;
      return aCreatedSort - bCreatedSort;
    });
  }, [filteredPolls]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const listNow = useMemo(() => new Date(), [nowTick]);

  const eventEligibleGroupCount = groups.filter(
    (g) => g.membershipStatus === 'member' || g.membershipStatus === 'admin'
  ).length;
  const unread = notifs.filter((n) => !n.read).length;
  const hasFilters = !!(
    (!lockedGroupId && selectedGroupIds.length > 0) ||
    startMode !== 'now' ||
    endMode !== 'allTime'
  );

  const inner = (
    <>
      {!embedded ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="bar-chart-outline" size={22} color={Colors.text} />
            <Text style={styles.title}>Polls</Text>
          </View>
          <View style={styles.headerActions}>
            <CreateOrJoinButton userId={currentUserId} eventEligibleGroupCount={eventEligibleGroupCount} />
            <TouchableOpacity
              onPress={() => setShowNotifs((p) => !p)}
              style={[
                styles.iconBtn,
                showNotifs && { borderColor: Colors.borderStrong, backgroundColor: Colors.bg },
              ]}
            >
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke={Colors.text}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </Svg>
              {unread > 0 && <View style={styles.bellDot} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.filtersContainer}>
        {!lockedGroupId ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsRow}
            contentContainerStyle={{ gap: 6, paddingRight: 20 }}
          >
            <Pill label="All" selected={selectedGroupIds.length === 0} onPress={() => setSelectedGroupIds([])} />
            {groups.map((g) => {
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
                  onPress={() =>
                    setSelectedGroupIds((prev) =>
                      isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                    )
                  }
                  onLongPress={() => setSelectedGroupIds([g.id])}
                />
              );
            })}
          </ScrollView>
        ) : null}

        <View
          style={[
            styles.filterPanel,
            { position: 'relative' },
            lockedGroupId && styles.filterPanelTopWhenNoPills,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingVertical: 8 }}
          >
            <TouchableOpacity
              onPress={() => setShowAdvancedFilters((p) => !p)}
              style={[
                styles.filterIconBtn,
                showAdvancedFilters && { borderColor: Colors.text, backgroundColor: Colors.text },
              ]}
            >
              <Svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={showAdvancedFilters ? Colors.surface : Colors.text}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </Svg>
            </TouchableOpacity>
            {hasFilters ? (
              <Pill
                label="Reset filters"
                onPress={() => {
                  setSelectedGroupIds(lockedGroupId ? [lockedGroupId] : []);
                  setStartMode('now');
                  setEndMode('allTime');
                  setStartDateText(defaultStartSpecificText);
                  setEndDateText(defaultEndSpecificText);
                }}
                selected={false}
              />
            ) : null}
          </ScrollView>

          {showAdvancedFilters ? (
            <View style={styles.filterExpandedRow}>
              <Text style={styles.filterExpandedHeader}>Deadline Range</Text>
              <View style={styles.dateFilterColumn}>
                <View style={styles.dateFilterRow}>
                  <Text style={styles.dateFilterFieldLabel}>From</Text>
                  <View style={styles.dateFieldWithNow}>
                    <TouchableOpacity
                      style={[styles.dateQuickButton, startMode === 'now' && styles.dateQuickButtonActive]}
                      onPress={() => setStartMode('now')}
                    >
                      <Text style={styles.dateQuickButtonText}>Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dateQuickButton,
                        startMode === 'allTime' && styles.dateQuickButtonActive,
                      ]}
                      onPress={() => setStartMode('allTime')}
                    >
                      <Text style={styles.dateQuickButtonText}>All time</Text>
                    </TouchableOpacity>
                    {Platform.OS === 'web' && WebDatePicker ? (
                      <View
                        style={[
                          styles.webPickerWrapper,
                          startMode === 'specific' && styles.dateSpecificWrapperActive,
                          activeDateField === 'from' && styles.webPickerActive,
                          { alignSelf: 'flex-start' },
                        ]}
                      >
                        <WebDatePicker
                          selected={startDateText ? parseDateTime(startDateText) : null}
                          onChange={(date: Date | null) => {
                            if (!date) return;
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            const hh = String(date.getHours()).padStart(2, '0');
                            const mm = String(date.getMinutes()).padStart(2, '0');
                            setStartDateText(`${y}-${m}-${d} ${hh}:${mm}`);
                            setStartMode('specific');
                          }}
                          popperPlacement="bottom-start"
                          withPortal
                          onCalendarOpen={() => {
                            setActiveDateField('from');
                            setStartMode('specific');
                          }}
                          onCalendarClose={() => setActiveDateField(null)}
                          showTimeSelect
                          timeIntervals={15}
                          dateFormat="yyyy-MM-dd HH:mm"
                          placeholderText={defaultStartSpecificText}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.dateValueChip,
                          startMode === 'specific' && styles.dateSpecificWrapperActive,
                        ]}
                        onPress={() => setStartMode('specific')}
                      >
                        <Text style={styles.dateValueText}>
                          {startMode === 'now'
                            ? 'Now'
                            : startMode === 'allTime'
                              ? 'All time'
                              : startDateText || defaultStartSpecificText}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.dateFilterRow}>
                  <Text style={styles.dateFilterFieldLabel}>To</Text>
                  <View style={styles.dateFieldWithNow}>
                    <TouchableOpacity
                      style={[styles.dateQuickButton, endMode === 'now' && styles.dateQuickButtonActive]}
                      onPress={() => setEndMode('now')}
                    >
                      <Text style={styles.dateQuickButtonText}>Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dateQuickButton, endMode === 'allTime' && styles.dateQuickButtonActive]}
                      onPress={() => setEndMode('allTime')}
                    >
                      <Text style={styles.dateQuickButtonText}>All time</Text>
                    </TouchableOpacity>
                    {Platform.OS === 'web' && WebDatePicker ? (
                      <View
                        style={[
                          styles.webPickerWrapper,
                          endMode === 'specific' && styles.dateSpecificWrapperActive,
                          activeDateField === 'to' && styles.webPickerActive,
                          { alignSelf: 'flex-start' },
                        ]}
                      >
                        <WebDatePicker
                          selected={endDateText ? parseDateTime(endDateText) : null}
                          onChange={(date: Date | null) => {
                            if (!date) return;
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            const hh = String(date.getHours()).padStart(2, '0');
                            const mm = String(date.getMinutes()).padStart(2, '0');
                            setEndDateText(`${y}-${m}-${d} ${hh}:${mm}`);
                            setEndMode('specific');
                          }}
                          popperPlacement="bottom-start"
                          withPortal
                          onCalendarOpen={() => {
                            setActiveDateField('to');
                            setEndMode('specific');
                          }}
                          onCalendarClose={() => setActiveDateField(null)}
                          showTimeSelect
                          timeIntervals={15}
                          dateFormat="yyyy-MM-dd HH:mm"
                          placeholderText={defaultEndSpecificText}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.dateValueChip,
                          endMode === 'specific' && styles.dateSpecificWrapperActive,
                        ]}
                        onPress={() => setEndMode('specific')}
                      >
                        <Text style={styles.dateValueText}>
                          {endMode === 'now'
                            ? 'Now'
                            : endMode === 'allTime'
                              ? 'All time'
                              : endDateText || defaultEndSpecificText}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.pollsScroll}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
      >
        {sortedPolls.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={50} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No polls yet</Text>
            <Text style={styles.emptyDesc}>Create a poll to see it here.</Text>
          </View>
        ) : (
          sortedPolls.map((poll, i) => {
            const group = groupsById[poll.groupId];
            const colorHex = groupColors[poll.groupId] || getDefaultGroupThemeFromName(group?.name ?? 'Group');
            return (
              <View key={poll.id} style={styles.pollCardWrap}>
                <PollRow
                  poll={poll}
                  group={group}
                  groupColorHex={colorHex}
                  showGroup={!lockedGroupId}
                  urgency={getDeadlineUrgency(poll, listNow)}
                  onPress={() =>
                      router.push(
                        withReturnTo(`/(tabs)/groups/${poll.groupId}/polls/${poll.id}`, pathname)
                      )
                    }
                  onGroupPress={(gid) => router.push(withReturnTo(`/(tabs)/groups/${gid}`, pathname))}
                  isLast={i === sortedPolls.length - 1}
                />
              </View>
            );
          })
        )}
      </ScrollView>

      {!embedded ? (
        <NotificationsPanelModal
          visible={showNotifs}
          onClose={() => setShowNotifs(false)}
          userId={currentUserId || ''}
          notifications={notifs}
          isLoading={notifsLoading}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          groupColors={groupColors}
        />
      ) : null}
    </>
  );

  return embedded ? (
    <View style={[styles.safe, styles.embeddedRoot]}>{inner}</View>
  ) : (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  embeddedRoot: { minHeight: 0 },
  pollsScroll: { flex: 1, backgroundColor: Colors.bg },
  pollCardWrap: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.tabHeaderMinHeight,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.notGoing,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillsRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterPanel: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterPanelTopWhenNoPills: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  filterIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  filterExpandedRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  filterExpandedHeader: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted },
  dateFilterColumn: { gap: 8 },
  dateFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateFilterFieldLabel: {
    width: 36,
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  dateFieldWithNow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  dateQuickButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  dateQuickButtonActive: { backgroundColor: Colors.bg },
  dateQuickButtonText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.text },
  dateValueChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  dateSpecificWrapperActive: { borderColor: Colors.text, backgroundColor: Colors.bg },
  dateValueText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.text },
  webPickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
  },
  webPickerActive: { borderColor: Colors.text },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text },
  emptyDesc: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textMuted },
});
