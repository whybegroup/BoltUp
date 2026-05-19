import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { withReturnTo } from '../../../utils/navigationReturn';
import { Colors, Fonts, Radius, Shadows } from '../../../constants/theme';
import { getGroupColor, getDefaultGroupThemeFromName, groupAvatarBorderRadius } from '../../../utils/helpers';
import {
  useEvents,
  useAllGroupMemberColors,
  useNotifications,
  useRecoverGroup,
  useUpdateGroupOrder,
} from '../../../hooks/api';
import { useCurrentUserContext } from '../../../contexts/CurrentUserContext';
import { GroupAvatar } from '../../../components/GroupAvatar';
import { NotificationsPanelModal } from '../../../components/NotificationsPanelModal';
import { GroupsTopHeader } from '../../../components/GroupsTopHeader';
import { GroupsBreadcrumbTrail } from '../../../components/GroupsBreadcrumbTrail';
import { useListGroups } from '../../../hooks/useListGroups';
import type { GroupScoped } from '@moijia/client';

function DragHandle({
  drag,
  disabled,
  label,
}: {
  drag: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onLongPress={Platform.OS === 'web' ? undefined : drag}
      onPressIn={Platform.OS === 'web' ? () => !disabled && drag() : undefined}
      disabled={disabled}
      style={styles.dragHandle}
      delayLongPress={120}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="reorder-three" size={22} color={Colors.textMuted} />
    </Pressable>
  );
}

function GroupRowBody({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.rowBody}>
      {children}
    </Pressable>
  );
}

function ListCell({ children, style, ...rest }: { children?: ReactNode; style?: object }) {
  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}

export default function GroupsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId: currentUserId } = useCurrentUserContext();
  const [showNotifs, setShowNotifs] = useState(false);
  const isDraggingRef = useRef(false);

  const { listGroups, data: allGroups = [] } = useListGroups(currentUserId ?? '', true);
  const recoverGroup = useRecoverGroup(currentUserId ?? '');
  const updateGroupOrder = useUpdateGroupOrder(currentUserId ?? '');
  const { data: events = [] } = useEvents({ userId: currentUserId ?? '', groupId: undefined });
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');

  const activeGroups = useMemo(() => listGroups.filter((g) => !g.deletedAt), [listGroups]);
  const deletedGroups = useMemo(() => listGroups.filter((g) => g.deletedAt), [listGroups]);
  const [orderedActiveGroups, setOrderedActiveGroups] = useState<GroupScoped[]>([]);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setOrderedActiveGroups(activeGroups);
  }, [activeGroups]);

  const eventEligibleGroupCount = activeGroups.filter(
    (g) => g.membershipStatus === 'member' || g.membershipStatus === 'admin'
  ).length;

  const handleRecover = async (groupId: string) => {
    try {
      await recoverGroup.mutateAsync(groupId);
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.response?.data?.error ?? e?.message ?? 'Failed to recover group';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const onDragBegin = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onDragEnd = useCallback(
    ({ data }: { data: GroupScoped[] }) => {
      isDraggingRef.current = false;
      setOrderedActiveGroups(data);
      if (!currentUserId || data.length < 2) return;
      updateGroupOrder.mutate(data.map((g) => g.id));
    },
    [currentUserId, updateGroupOrder]
  );

  const unread = notifs.filter((n) => !n.read).length;
  const now = new Date();
  const upcomingWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const renderActiveGroupRow = useCallback(
    ({ item: g, drag, isActive }: RenderItemParams<GroupScoped>) => {
      const userColorHex = groupColors[g.id] || getDefaultGroupThemeFromName(g.name);
      const p = getGroupColor(userColorHex);
      const announcementTrim = (g.announcement ?? '').trim();
      const evCount = events.filter((e) => {
        const start = new Date(e.start);
        return e.groupId === g.id && start >= now && start <= upcomingWeekEnd;
      }).length;
      return (
        <View
          style={[styles.groupItemCard, isActive && styles.groupItemCardDragging, isActive && Shadows.sm]}
        >
          <View style={styles.row}>
            <DragHandle drag={drag} disabled={isActive} label={`Reorder ${g.name}`} />
            <GroupRowBody
              onPress={() => router.push(withReturnTo(`/(tabs)/groups/${g.id}`, pathname))}
              disabled={isActive}
            >
              <View style={[styles.groupIconOuter, { backgroundColor: p.cal }]}>
                <View style={styles.groupIconInner}>
                  <GroupAvatar seed={g.avatarSeed} thumbnail={g.thumbnail} name={g.name} size={44} />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.groupMeta}>
                  {g.memberCount} members
                  {evCount > 0 ? ` · ${evCount} upcoming events` : ''}
                </Text>
                {announcementTrim ? (
                  <View style={styles.groupAnnouncementRow}>
                    <Ionicons name="megaphone-outline" size={14} color={Colors.maybe} style={{ flexShrink: 0 }} />
                    <Text style={styles.groupAnnouncementText} numberOfLines={1} ellipsizeMode="tail">
                      {announcementTrim}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {g.membershipStatus === 'pending' && (
                  <View style={[styles.adminBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                    <Text style={[styles.adminBadgeText, { color: '#B45309' }]}>Pending</Text>
                  </View>
                )}
                {g.ownerId === currentUserId && (
                  <View style={[styles.adminBadge, { backgroundColor: '#FEF9C3', borderColor: '#EAB308' }]}>
                    <Text style={[styles.adminBadgeText, { color: '#854D0E' }]}>Owner</Text>
                  </View>
                )}
                {g.membershipStatus === 'admin' && g.ownerId !== currentUserId && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
                <Text style={{ color: Colors.textMuted, fontSize: 18 }}>›</Text>
              </View>
            </GroupRowBody>
          </View>
        </View>
      );
    },
    [groupColors, events, now, upcomingWeekEnd, currentUserId, router, pathname]
  );

  const deletedSection =
    deletedGroups.length > 0 ? (
      <View style={styles.footerSection}>
        <Text style={styles.sectionLabel}>Deactivated</Text>
        {deletedGroups.map((g) => {
            const userColorHex = groupColors[g.id] || getDefaultGroupThemeFromName(g.name);
            const p = getGroupColor(userColorHex);
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => router.push(withReturnTo(`/(tabs)/groups/${g.id}`, pathname))}
                style={[styles.groupItemCard, styles.deletedRow]}
                activeOpacity={0.7}
              >
              <View style={styles.row}>
                <View style={styles.dragHandleSpacer} />
                <View style={[styles.groupIconOuter, { backgroundColor: p.cal, opacity: 0.7 }]}>
                  <View style={styles.groupIconInner}>
                    <GroupAvatar seed={g.avatarSeed} thumbnail={g.thumbnail} name={g.name} size={44} />
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.groupName, { color: Colors.textMuted }]}>{g.name}</Text>
                  <Text style={styles.groupMeta}>Deactivated</Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRecover(g.id);
                  }}
                  style={styles.recoverBtn}
                  disabled={recoverGroup.isPending}
                >
                  <Text style={styles.recoverBtnText}>Recover</Text>
                </TouchableOpacity>
              </View>
              </TouchableOpacity>
            );
          })}
      </View>
    ) : null;

  const listFooter = (
    <>
      {deletedSection}
      <View style={styles.listBottomPad} />
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <GroupsTopHeader
        userId={currentUserId}
        eventEligibleGroupCount={eventEligibleGroupCount}
        showNotifs={showNotifs}
        onToggleNotifs={() => setShowNotifs((p) => !p)}
        unreadCount={unread}
      />

      <GroupsBreadcrumbTrail segments={[{ label: 'All Groups' }]} />

      {listGroups.length === 0 ? (
        <View style={styles.myEmpty}>
          <Ionicons name="people-outline" size={48} color={Colors.textMuted} style={styles.emptyGlyph} />
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyDesc}>Create a group or join with an invite code.</Text>
        </View>
      ) : orderedActiveGroups.length > 0 ? (
        <DraggableFlatList
          data={orderedActiveGroups}
          keyExtractor={(g) => g.id}
          renderItem={renderActiveGroupRow}
          onDragBegin={onDragBegin}
          onDragEnd={onDragEnd}
          activationDistance={10}
          // List cell must be a View on web — default renderer uses <button> and breaks nested controls
          CellRendererComponent={ListCell as never}
          containerStyle={styles.listContainer}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.groupItemGap} />}
          ListFooterComponent={listFooter}
        />
      ) : (
        <View style={styles.listContent}>{listFooter}</View>
      )}

      <NotificationsPanelModal
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={currentUserId || ''}
        notifications={notifs}
        isLoading={notifsLoading}
        groups={allGroups.map((g) => ({ id: g.id, name: g.name }))}
        groupColors={groupColors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, flexGrow: 1 },
  listBottomPad: { height: 100 },
  footerSection: { marginTop: 8, gap: 6 },
  groupItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  groupItemCardDragging: {
    borderColor: Colors.textMuted,
  },
  groupItemGap: { height: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingRight: 14, paddingLeft: 8 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  dragHandle: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  dragHandleSpacer: { width: 34 },
  groupIconOuter: {
    width: 46,
    height: 46,
    borderRadius: groupAvatarBorderRadius(44) + 1,
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  groupIconInner: {
    width: 44,
    height: 44,
    borderRadius: groupAvatarBorderRadius(44),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  groupName: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.text, marginBottom: 2 },
  groupMeta: { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  groupAnnouncementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    minWidth: 0,
  },
  groupAnnouncementText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#92400E',
    lineHeight: 18,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSub },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  myEmpty: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, paddingBottom: 8 },
  emptyGlyph: { marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 6 },
  emptyDesc: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  deletedRow: { backgroundColor: 'rgba(0,0,0,0.03)' },
  recoverBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.lg, backgroundColor: Colors.going },
  recoverBtnText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fff' },
});
