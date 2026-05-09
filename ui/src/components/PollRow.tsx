import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Poll, GroupScoped } from '@moijia/client';
import { PollOptionInputKind } from '@moijia/client';
import { Colors, Fonts } from '../constants/theme';
import { getGroupColor, getDefaultGroupThemeFromName, fmtTime } from '../utils/helpers';

function stripHtmlPreview(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deadlineForPoll(poll: Poll): Date | null {
  if ((poll as Poll & { deadline?: string | null }).deadline) {
    const direct = new Date((poll as Poll & { deadline?: string | null }).deadline as string);
    if (Number.isFinite(direct.getTime())) return direct;
  }
  let minTs = Number.POSITIVE_INFINITY;
  for (const option of poll.options) {
    if (option.inputKind !== PollOptionInputKind.DATETIME || !option.dateTimeValue) continue;
    const ts = new Date(option.dateTimeValue).getTime();
    if (Number.isFinite(ts) && ts < minTs) minTs = ts;
  }
  return Number.isFinite(minTs) ? new Date(minTs) : null;
}

function pollIsEffectivelyClosed(poll: Poll): boolean {
  const pollWithCloseState = poll as Poll & {
    closedAt?: string;
    closedBy?: string;
    closedByName?: string;
    closed?: boolean;
    isClosed?: boolean;
    status?: string;
  };
  const closedAt = pollWithCloseState.closedAt;
  const closedByFlag =
    pollWithCloseState.closed === true ||
    pollWithCloseState.isClosed === true ||
    String(pollWithCloseState.status || '').toLowerCase() === 'closed';
  return Boolean(
    closedAt || pollWithCloseState.closedBy || pollWithCloseState.closedByName || closedByFlag
  );
}

export type DeadlineUrgency = {
  label: string;
  tone: 'critical' | 'soon' | 'calm';
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Relative deadline badge for open polls; omit for closed or no deadline. */
export function getDeadlineUrgency(poll: Poll, now: Date = new Date()): DeadlineUrgency | null {
  if (pollIsEffectivelyClosed(poll)) return null;
  const dl = deadlineForPoll(poll);
  if (!dl) return null;
  const ms = dl.getTime() - now.getTime();
  if (ms <= 0) return null;

  const minutesLeft = Math.ceil(ms / 60000);
  if (minutesLeft <= 60) {
    if (minutesLeft <= 1) return { label: 'Closes within 1 min', tone: 'critical' };
    if (minutesLeft < 60) return { label: `Closes in ${minutesLeft} min`, tone: 'critical' };
    return { label: 'Closes within 1 hour', tone: 'critical' };
  }

  const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfLocalDay(dl).getTime() - startOfLocalDay(now).getTime()) / 86400000
  );

  if (dayDiff === 0) return { label: 'Closes today', tone: 'soon' };
  if (dayDiff === 1) return { label: 'Closes tomorrow', tone: 'soon' };
  if (dayDiff >= 2 && dayDiff <= 13) {
    return { label: `Closes in ${dayDiff} days`, tone: 'calm' };
  }

  const yNow = now.getFullYear();
  const yDl = dl.getFullYear();
  const mon = MONTHS_SHORT[dl.getMonth()];
  const label =
    yDl === yNow ? `Closes ${mon} ${dl.getDate()}` : `Closes ${mon} ${dl.getDate()}, ${yDl}`;
  return { label, tone: 'calm' };
}

function formatClosesByLine(d: Date): string {
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  return `Closes by ${dateStr} ${fmtTime(d)}`;
}

function formatClosedByLine(d: Date): string {
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  return `Closed on ${dateStr} ${fmtTime(d)}`;
}

export interface PollRowProps {
  poll: Poll;
  group?: GroupScoped;
  groupColorHex?: string;
  onPress: () => void;
  onGroupPress?: (groupId: string) => void;
  isLast?: boolean;
  showGroup?: boolean;
  /** When set, shown as a pill next to the title (e.g. “Closes today”). */
  urgency?: DeadlineUrgency | null;
}

export function PollRow({
  poll,
  group,
  groupColorHex,
  onPress,
  onGroupPress,
  isLast = false,
  showGroup = true,
  urgency,
}: PollRowProps) {
  const p = getGroupColor(groupColorHex || (group ? getDefaultGroupThemeFromName(group.name) : '#EC4899'));
  const dl = deadlineForPoll(poll);
  const pollWithCloseState = poll as Poll & {
    closedAt?: string;
    closedBy?: string;
    closedByName?: string;
  };
  const closedAt = pollWithCloseState.closedAt;
  const closedAtDate = closedAt ? new Date(closedAt) : null;
  const hasClosedMarker = pollIsEffectivelyClosed(poll);
  const now = Date.now();
  const isPastByDeadline = dl ? dl.getTime() <= now : false;
  const isClosed = hasClosedMarker || isPastByDeadline;
  const isPast = isClosed;
  const closedOnDate = hasClosedMarker
    ? closedAtDate && Number.isFinite(closedAtDate.getTime())
      ? closedAtDate
      : dl
    : isPastByDeadline
      ? dl
      : null;
  const closesLine = isClosed
    ? closedOnDate
      ? formatClosedByLine(closedOnDate)
      : 'Closed'
    : dl
      ? formatClosesByLine(dl)
      : 'No deadline set';
  const descPreview = poll.description?.trim()
    ? stripHtmlPreview(poll.description).slice(0, 120) + (stripHtmlPreview(poll.description).length > 120 ? '…' : '')
    : '';

  const memberTotal = group?.memberCount ?? 0;
  const responded = poll.respondentCount ?? 0;
  const responseLine = `${responded}/${memberTotal} Responded`;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: isPast ? '#F5F5F4' : Colors.surface,
          borderLeftWidth: 3,
          borderLeftColor: isPast ? Colors.border : p.dot,
          opacity: isPast ? 0.5 : 1,
        },
        !isLast && styles.rowBorder,
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {poll.title}
          </Text>
          {urgency ? (
            <View
              style={[
                styles.urgencyBadge,
                urgency.tone === 'critical' && styles.urgencyBadgeCritical,
                urgency.tone === 'soon' && styles.urgencyBadgeSoon,
                urgency.tone === 'calm' && styles.urgencyBadgeCalm,
              ]}
            >
              <Text
                style={[
                  styles.urgencyBadgeText,
                  urgency.tone === 'critical' && styles.urgencyBadgeTextCritical,
                  urgency.tone === 'soon' && styles.urgencyBadgeTextSoon,
                ]}
                numberOfLines={1}
              >
                {urgency.label}
              </Text>
            </View>
          ) : null}
        </View>
        {showGroup && group ? (
          <Pressable
            onPress={() => onGroupPress?.(poll.groupId)}
            style={({ pressed }) => [
              styles.groupNameWrap,
              onGroupPress && pressed && { backgroundColor: p.label, borderRadius: 6 },
            ]}
            disabled={!onGroupPress}
          >
            <Text style={[styles.groupName, onGroupPress && { color: p.dot }]} numberOfLines={1}>
              {group.name}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={Colors.textMuted} style={styles.metaIcon} />
          <Text style={styles.meta} numberOfLines={2}>
            {closesLine}
          </Text>
        </View>
        {descPreview ? (
          <View style={styles.descRow}>
            <Ionicons name="document-text-outline" size={14} color={Colors.textMuted} style={styles.metaIcon} />
            <Text style={styles.meta} numberOfLines={2}>
              {descPreview}
            </Text>
          </View>
        ) : null}
        <Text style={styles.responseLine}>{responseLine}</Text>
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
    position: 'relative',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 120,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  urgencyBadgeCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: Colors.todayRed,
  },
  urgencyBadgeSoon: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  urgencyBadgeCalm: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  urgencyBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  urgencyBadgeTextCritical: {
    color: Colors.todayRed,
  },
  urgencyBadgeTextSoon: {
    color: '#B45309',
  },
  groupNameWrap: {
    alignSelf: 'flex-start',
    marginBottom: 2,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    paddingVertical: 2,
    marginVertical: -2,
  },
  groupName: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 1,
  },
  descRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 3,
  },
  metaIcon: {
    marginTop: 1,
  },
  meta: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  responseLine: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
  },
});
