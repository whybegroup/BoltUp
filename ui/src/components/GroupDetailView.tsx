import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { KeyboardFormRoot, KeyboardSafeScrollView } from './KeyboardSafeScrollView';
import * as Clipboard from 'expo-clipboard';
import { usePathname, type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { getGroupColor, getDefaultGroupThemeFromName, groupAvatarBorderRadius } from '../utils/helpers';
import { formSectionTitleStyle, Avatar } from './ui';
import {
  useGroup,
  useUsers,
  useGroupMembers,
  useGroupMemberColor,
  usePendingRequests,
  useUpdateGroup,
  useRegenerateInviteCode,
  useLeaveGroup,
  useSoftDeleteGroup,
  useDeleteGroup,
  useRecoverGroup,
  useEvents,
} from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { GroupAvatar } from './GroupAvatar';
import { AvatarPickerModal } from './AvatarPickerModal';
import { UserAvatar } from './UserAvatar';
import { deleteManagedUploadFireAndForget } from '../services/managedUploadDelete';
import { ResolvableImage } from './ResolvableImage';
import { pickAndUploadCoverPhoto, takeAndUploadCoverPhoto } from '../services/pickAndUploadImage';
import Toast from 'react-native-toast-message';
import { ImageLightboxModal } from './ImageLightboxModal';
import { groupSubpageFromPathname } from './groupScope/useGroupSubpage';
import { groupsTabParentHref, navigateGroupsTabTo } from '../utils/tabBreadcrumbNav';
import { useGroupScopeNav } from './groupScope/GroupScopeNavContext';
import { AddImageButton } from './AddImageButton';

const AVATAR_SIZE = 56;

/** Heuristic + newline check so long single-line copy still gets Read more. */
function descriptionExceedsTwoLines(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (s.split(/\r?\n/).length > 2) return true;
  if (s.length > 200) return true;
  return false;
}

export type GroupDetailViewProps = {
  groupId: string;
};

export function GroupDetailView({ groupId }: GroupDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const groupsTabNav = useGroupScopeNav();

  const navigateToParent = useCallback(() => {
    const subpage = groupSubpageFromPathname(pathname, groupId);
    const parent = groupsTabParentHref(groupId, subpage);
    if (parent) {
      navigateGroupsTabTo(router, parent, groupId, groupsTabNav);
    }
  }, [pathname, groupId, router, groupsTabNav]);

  const dismiss = navigateToParent;

  const goToAllGroups = useCallback(() => {
    navigateGroupsTabTo(router, '/(tabs)/groups' as Href, groupId, groupsTabNav);
  }, [router, groupId, groupsTabNav]);

  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError, refetch: refetchGroup } = useGroup(groupId, currentUserId ?? '');
  const { data: memberColorData, refetch: refetchMemberColor } = useGroupMemberColor(
    groupId,
    currentUserId ?? ''
  );
  const { data: users = [], refetch: refetchUsers } = useUsers();
  const { data: groupMembers = [], refetch: refetchGroupMembers } = useGroupMembers(
    groupId,
    currentUserId ?? '',
    {
    enabled:
      !!group && (group.membershipStatus === 'member' || group.membershipStatus === 'admin'),
    }
  );
  const { data: pendingRequestUsers = [], refetch: refetchPendingRequests } = usePendingRequests(
    groupId,
    currentUserId ?? '',
    {
      enabled: group?.membershipStatus === 'admin',
    }
  );
  const updateGroup = useUpdateGroup(groupId, currentUserId ?? '');
  const regenerateInviteCodeMutation = useRegenerateInviteCode(groupId, currentUserId ?? '');
  const leaveGroupMutation = useLeaveGroup();
  const softDeleteMutation = useSoftDeleteGroup(currentUserId ?? '');
  const hardDeleteMutation = useDeleteGroup(currentUserId ?? '');
  const recoverMutation = useRecoverGroup(currentUserId ?? '');

  /** Events starting up to 14d ago (ongoing) through 7d ahead (upcoming). */
  const groupEventsFetchWindow = useMemo(() => {
    const now = new Date();
    const lookback = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      startAfter: lookback.toISOString(),
      startBefore: weekEnd.toISOString(),
      weekEndMs: weekEnd.getTime(),
    };
  }, [groupId]);
  const fetchGroupWeekEvents =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');
  const { data: groupWeekEvents = [], refetch: refetchGroupEvents } = useEvents({
    userId: currentUserId ?? '',
    groupId,
    startAfter: groupEventsFetchWindow.startAfter,
    startBefore: groupEventsFetchWindow.startBefore,
    limit: 200,
    enabled: fetchGroupWeekEvents,
  });
  const [eventsSummaryNowTick, setEventsSummaryNowTick] = useState(0);
  const groupEventsSummary = useMemo(() => {
    const nowMs = Date.now();
    const { weekEndMs } = groupEventsFetchWindow;
    let inProgressCount = 0;
    let upcomingCount = 0;
    for (const ev of groupWeekEvents) {
      const s = new Date(ev.start).getTime();
      const e = new Date(ev.end).getTime();
      if (s <= nowMs && e > nowMs) {
        inProgressCount += 1;
      } else if (s > nowMs && s <= weekEndMs) {
        upcomingCount += 1;
      }
    }
    return { inProgressCount, upcomingCount };
  }, [groupWeekEvents, groupEventsFetchWindow, eventsSummaryNowTick]);
  const { refreshControl } = usePullToRefresh([
    refetchGroup,
    refetchUsers,
    refetchGroupMembers,
    refetchPendingRequests,
    refetchGroupEvents,
    refetchMemberColor,
  ]);
    const groupEventsSummaryButtonLine = useMemo(() => {
    const { inProgressCount, upcomingCount } = groupEventsSummary;
    const parts: string[] = [];
    if (inProgressCount > 0) parts.push(`${inProgressCount} in progress`);
    if (upcomingCount > 0) parts.push(`${upcomingCount} upcoming events`);
    return parts.join(' · ');
  }, [groupEventsSummary.inProgressCount, groupEventsSummary.upcomingCount]);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftAnnouncement, setDraftAnnouncement] = useState('');
  const [editingGroupProfile, setEditingGroupProfile] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [showAnnouncementReadModal, setShowAnnouncementReadModal] = useState(false);
  const [coverPhotoBusy, setCoverPhotoBusy] = useState(false);
  const [localCoverPhotos, setLocalCoverPhotos] = useState<string[]>([]);
  const [groupPhotoLightbox, setGroupPhotoLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const coverHydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!group) return;
    setDraftName(group.name);
    setDraftDesc(group.desc ?? '');
    setDraftAnnouncement(group.announcement ?? '');
  }, [group?.id, group?.name, group?.desc, group?.announcement]);

  useEffect(() => {
    if (!group) return;
    if (coverHydratedRef.current === group.id) return;
    coverHydratedRef.current = group.id;
    setLocalCoverPhotos(group.coverPhotos ?? []);
  }, [group]);

  const profileDirty = useMemo(() => {
    if (!group || group.membershipStatus !== 'admin' || !editingGroupProfile) return false;
    return (
      draftName.trim() !== group.name.trim() ||
      draftDesc.trim() !== (group.desc ?? '').trim()
    );
  }, [group, draftName, draftDesc, editingGroupProfile]);

  const confirmDiscardThen = useCallback((action: () => void) => {
    if (!profileDirty) {
      action();
      return;
    }
    const message = 'Discard your changes?';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) action();
      return;
    }
    Alert.alert('Discard changes?', message, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: action },
    ]);
  }, [profileDirty]);

  useEffect(() => {
    if (isError || (group && group.membershipStatus === 'none')) {
      router.replace('/(tabs)/groups');
    }
  }, [isError, group?.membershipStatus, router]);
  const [showLeave,   setShowLeave]   = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSeedDraft, setAvatarSeedDraft] = useState('');
  const [avatarThumbnailDraft, setAvatarThumbnailDraft] = useState<string | null>(null);
  const thumbnailAtPickerOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (showAvatarPicker && group) {
      setAvatarSeedDraft(group.avatarSeed ?? '');
      setAvatarThumbnailDraft(group.thumbnail ?? null);
    }
  }, [showAvatarPicker, group?.avatarSeed, group?.thumbnail]);

  useEffect(() => {
    if (!fetchGroupWeekEvents) return;
    const interval = setInterval(() => setEventsSummaryNowTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [fetchGroupWeekEvents]);

  const usersMap = useMemo(() => {
    const map: Record<string, any> = {};
    users.forEach(u => map[u.id] = u);
    return map;
  }, [users]);

  // Prefer groupMembers (includes avatarSeed, thumbnail); fall back to users
  const membersMap = useMemo(() => {
    const map: Record<string, any> = {};
    groupMembers.forEach(u => map[u.id] = u);
    return map;
  }, [groupMembers]);

  const getUser = (userId: string) => {
    return membersMap[userId] || usersMap[userId] || { id: userId, name: 'Loading...', displayName: 'Loading...', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  };

  useEffect(() => {
    setDescExpanded(false);
    setEditingGroupProfile(false);
    setEditingAnnouncement(false);
    setShowAnnouncementReadModal(false);
  }, [groupId]);

  const resetProfileDrafts = useCallback(() => {
    if (!group) return;
    setDraftName(group.name);
    setDraftDesc(group.desc ?? '');
  }, [group]);

  const requestOverview = useCallback(() => {
    confirmDiscardThen(() => {
      resetProfileDrafts();
      setEditingGroupProfile(false);
      setDescExpanded(false);
      goToAllGroups();
    });
  }, [confirmDiscardThen, resetProfileDrafts, goToAllGroups]);

  const requestExitProfileEdit = useCallback(() => {
    confirmDiscardThen(() => {
      resetProfileDrafts();
      setEditingGroupProfile(false);
      setDescExpanded(false);
    });
  }, [confirmDiscardThen, resetProfileDrafts]);

  const isAdminForDesc = group?.membershipStatus === 'admin';
  const descNeedsReadMore = useMemo(() => {
    const src =
      editingGroupProfile && isAdminForDesc ? draftDesc : (group?.desc ?? '');
    return descriptionExceedsTwoLines(src);
  }, [editingGroupProfile, isAdminForDesc, draftDesc, group?.desc]);

  if (!group) {
    return null;
  }

  const dismissAvatarPicker = () => {
    setShowAvatarPicker(false);
    setAvatarSeedDraft(group.avatarSeed ?? '');
    setAvatarThumbnailDraft(group.thumbnail ?? null);
  };

  const ownerId = group.ownerId ?? '';
  const admins = group.adminIds ?? [];
  const isOwner = ownerId === currentUserId;
  const isAdmin = group.membershipStatus === 'admin';
  const isPending = group.membershipStatus === 'pending';
  const isSoftDeleted = !!group.deletedAt;
  const canEditMain = isAdmin && !isPending;
  const canOpenGroupSettings =
    !isPending &&
    !!currentUserId &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');
  const canEditAnnouncement = !isPending && (isAdmin || isOwner);
  const visiblePendingMembers = (isAdmin || isOwner) ? pendingRequestUsers : [];
  const membersCount = (group.memberIds ?? []).length;
  const membersPreviewLabel = `${membersCount} member${membersCount === 1 ? '' : 's'}`;
  const pendingPreviewLabel =
    visiblePendingMembers.length > 0 ? ` · ${visiblePendingMembers.length} pending` : '';
  const membersPreviewSubLabel = `${membersPreviewLabel}${pendingPreviewLabel}`;
  const leaveGroup = async () => {
    if (!currentUserId) return;
    try {
      await leaveGroupMutation.mutateAsync({ groupId, userId: currentUserId });
      dismiss();
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.response?.data?.error ?? e?.message ?? 'Failed to leave group';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const doSoftDelete = async () => {
    setShowDeactivateConfirm(false);
    try {
      await softDeleteMutation.mutateAsync(groupId);
      dismiss();
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.response?.data?.error ?? e?.message ?? 'Failed to deactivate';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const doHardDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await hardDeleteMutation.mutateAsync(groupId);
      dismiss();
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.response?.data?.error ?? e?.message ?? 'Failed to delete';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const doRecover = async () => {
    try {
      await recoverMutation.mutateAsync(groupId);
    } catch (e: any) {
      const msg = e?.body?.error ?? e?.response?.data?.error ?? e?.message ?? 'Failed to recover';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const canSeeInviteCode = group.membershipStatus === 'member' || group.membershipStatus === 'admin';
  const inviteCode = canSeeInviteCode ? (group.inviteCode ?? '').trim() : '';

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(inviteCode).catch(() => {});
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const confirmRegenerateInviteCode = () => {
    const run = () => {
      regenerateInviteCodeMutation.mutate(undefined, {
        onError: (e: any) => {
          const msg = e?.body?.error ?? e?.message ?? 'Failed to generate a new code';
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Error', msg);
        },
      });
    };
    const message =
      'The current invite code will stop working for new joins. Existing members are not affected.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) run();
    } else {
      Alert.alert('Generate new invite code?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: run },
      ]);
    }
  };

  const saveProfileDrafts = async () => {
    const name = draftName.trim();
    if (!name) {
      if (Platform.OS === 'web') window.alert('Group name is required');
      else Alert.alert('Error', 'Group name is required');
      return;
    }
    try {
      await updateGroup.mutateAsync({
        name,
        desc: draftDesc.trim(),
        updatedBy: currentUserId ?? '',
      });
      setEditingGroupProfile(false);
      setDescExpanded(false);
      Toast.show({ type: 'success', text1: 'Changes saved' });
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to save changes');
      else Alert.alert('Error', 'Failed to save changes');
    }
  };

  const saveAnnouncement = async () => {
    const trimmed = draftAnnouncement.trim();
    try {
      await updateGroup.mutateAsync({
        announcement: trimmed || null,
        updatedBy: currentUserId ?? '',
      });
      setEditingAnnouncement(false);
      if (!trimmed) {
        setShowAnnouncementReadModal(false);
      }
      Toast.show({ type: 'success', text1: trimmed ? 'Announcement updated' : 'Announcement removed' });
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to save announcement');
      else Alert.alert('Error', 'Failed to save announcement');
    }
  };

  const cancelAnnouncementEdit = () => {
    const hadNoAnnouncement = !(group.announcement ?? '').trim();
    setDraftAnnouncement(group.announcement ?? '');
    setEditingAnnouncement(false);
    if (hadNoAnnouncement) {
      setShowAnnouncementReadModal(false);
    }
  };

  const closeAnnouncementModal = () => {
    setDraftAnnouncement(group.announcement ?? '');
    setEditingAnnouncement(false);
    setShowAnnouncementReadModal(false);
  };

  const canEditPhotos = isAdmin && !isPending;
  const coverPhotosForDisplay = isAdmin ? localCoverPhotos : (group.coverPhotos ?? []);
  const showGroupCoverSection = true;

  const removeCoverPhotoAt = async (index: number) => {
    if (!currentUserId || !canEditPhotos) return;
    const prev = localCoverPhotos;
    const next = prev.filter((_, j) => j !== index);
    setLocalCoverPhotos(next);
    try {
      await updateGroup.mutateAsync({
        coverPhotos: next,
        updatedBy: currentUserId,
      });
    } catch {
      setLocalCoverPhotos(prev);
      if (Platform.OS === 'web') window.alert('Failed to remove photo');
      else Alert.alert('Error', 'Failed to remove photo');
    }
  };

  const addCoverPhoto = async (url: string) => {
    if (!currentUserId || !canEditPhotos) return;
    const prev = localCoverPhotos;
    const next = [...prev, url];
    setLocalCoverPhotos(next);
    try {
      await updateGroup.mutateAsync({
        coverPhotos: next,
        updatedBy: currentUserId,
      });
    } catch {
      setLocalCoverPhotos(prev);
      if (Platform.OS === 'web') window.alert('Failed to add photo');
      else Alert.alert('Error', 'Failed to add photo');
    }
  };

  const addCoverPhotoFromPicker = async () => {
    if (!currentUserId || !canEditPhotos || coverPhotoBusy) return;
    setCoverPhotoBusy(true);
    try {
      const url = await pickAndUploadCoverPhoto(currentUserId);
      if (url) await addCoverPhoto(url);
    } finally {
      setCoverPhotoBusy(false);
    }
  };

  const addCoverPhotoFromCamera = async () => {
    if (!currentUserId || !canEditPhotos || coverPhotoBusy) return;
    setCoverPhotoBusy(true);
    try {
      const url = await takeAndUploadCoverPhoto(currentUserId);
      if (url) await addCoverPhoto(url);
    } finally {
      setCoverPhotoBusy(false);
    }
  };

  const groupPhotosBlock = showGroupCoverSection ? (
    <View style={styles.groupPhotosSectionWrap}>
      <Text style={styles.sectionLabel}>
        PHOTOS{coverPhotosForDisplay.length > 0 ? ` · ${coverPhotosForDisplay.length}` : ''}
      </Text>
      <View style={styles.card}>
        {coverPhotosForDisplay.length > 0 || canEditPhotos ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{
              borderBottomWidth: canEditPhotos ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: Colors.border,
            }}
            contentContainerStyle={{ gap: 4, paddingVertical: 10, paddingHorizontal: 16 }}
          >
            {canEditPhotos ? (
              <AddImageButton
                tile
                triggerIconName="camera-outline"
                label="Add photo"
                busy={coverPhotoBusy}
                disabled={coverPhotoBusy}
                onTakePhoto={addCoverPhotoFromCamera}
                onChooseFromLibrary={addCoverPhotoFromPicker}
                onInsertLink={async (url) => {
                  await addCoverPhoto(url);
                }}
              />
            ) : null}
            {coverPhotosForDisplay.map((uri, i) => (
              <View key={`${uri}-${i}`} style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={() => setGroupPhotoLightbox({ urls: coverPhotosForDisplay, index: i })}
                  activeOpacity={0.9}
                >
                  <ResolvableImage
                    storedUrl={uri}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: Radius.lg,
                      backgroundColor: Colors.bg,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: Colors.border,
                    }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {canEditPhotos && (
                  <TouchableOpacity
                    onPress={() => void removeCoverPhotoAt(i)}
                    style={styles.coverRemoveThumb}
                  >
                    <Ionicons name="close" size={11} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  ) : null;

  const scrollAndOverlays = (
    <>
      {(() => {
        const annTrim = (group.announcement ?? '').trim();
        if (!annTrim && !canEditAnnouncement) return null;
        const onAnnouncementRowPress = () => {
          if (!annTrim && canEditAnnouncement) {
            setDraftAnnouncement('');
            setEditingAnnouncement(true);
          } else {
            setDraftAnnouncement(group.announcement ?? '');
            setEditingAnnouncement(false);
          }
          setShowAnnouncementReadModal(true);
        };
        const announcementRowA11yLabel =
          !annTrim && canEditAnnouncement ? 'Add announcement' : 'View announcement';
        return (
          <View style={styles.announcementSection}>
            <TouchableOpacity
              style={[styles.announcementRow, annTrim ? styles.announcementRowHasContent : null]}
              onPress={onAnnouncementRowPress}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={announcementRowA11yLabel}
            >
              <Ionicons
                name="megaphone-outline"
                size={18}
                color={annTrim ? Colors.maybe : Colors.textMuted}
                style={styles.announcementRowLeadingIcon}
              />
              {annTrim ? (
                <View style={styles.announcementTextWrap} pointerEvents="box-none">
                  <Text style={styles.announcementRowTextEmphasis} numberOfLines={1} ellipsizeMode="tail">
                    {annTrim}
                  </Text>
                </View>
              ) : (
                <View style={styles.announcementTextWrap}>
                  <Text style={styles.announcementRowPlaceholder}>Add announcement</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
      })()}

      <KeyboardSafeScrollView
        style={styles.groupScrollView}
        contentContainerStyle={styles.groupScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <View style={styles.groupMainCardWrap}>
          <View style={styles.groupMainCard}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={styles.groupProfileTopRow}>
              {canEditMain && editingGroupProfile ? (
                <TouchableOpacity
                  onPress={() => {
                    thumbnailAtPickerOpenRef.current = group.thumbnail ?? null;
                    setShowAvatarPicker(true);
                  }}
                  style={[
                    styles.groupThumb,
                    {
                      backgroundColor: getGroupColor(memberColorData?.colorHex || getDefaultGroupThemeFromName(group.name)).row,
                      borderColor: getGroupColor(memberColorData?.colorHex || getDefaultGroupThemeFromName(group.name)).cal,
                      borderRadius: groupAvatarBorderRadius(AVATAR_SIZE),
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <GroupAvatar
                    seed={group.avatarSeed}
                    thumbnail={group.thumbnail}
                    name={group.name}
                    size={AVATAR_SIZE}
                    style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.groupThumb,
                    {
                      backgroundColor: getGroupColor(memberColorData?.colorHex || getDefaultGroupThemeFromName(group.name)).row,
                      borderColor: getGroupColor(memberColorData?.colorHex || getDefaultGroupThemeFromName(group.name)).cal,
                      borderRadius: groupAvatarBorderRadius(AVATAR_SIZE),
                    },
                  ]}
                >
                  <GroupAvatar
                    seed={group.avatarSeed}
                    thumbnail={group.thumbnail}
                    name={group.name}
                    size={AVATAR_SIZE}
                    style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  />
                </View>
              )}
              <View style={styles.groupProfileTrailing}>
                {canEditMain ? (
                  <View style={styles.groupProfileEditActions}>
                    {editingGroupProfile && profileDirty ? (
                      <>
                        <TouchableOpacity
                          onPress={resetProfileDrafts}
                          disabled={updateGroup.isPending}
                          style={[styles.groupProfileEditBtn, updateGroup.isPending && { opacity: 0.45 }]}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Reset group name and description"
                        >
                          <Ionicons name="refresh-outline" size={20} color={Colors.textSub} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void saveProfileDrafts()}
                          disabled={!draftName.trim() || updateGroup.isPending}
                          style={[
                            styles.groupProfileEditBtn,
                            (!draftName.trim() || updateGroup.isPending) && { opacity: 0.45 },
                          ]}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Save group name and description"
                        >
                          {updateGroup.isPending ? (
                            <ActivityIndicator size="small" color={Colors.textSub} />
                          ) : (
                            <Ionicons name="checkmark" size={20} color={Colors.text} />
                          )}
                        </TouchableOpacity>
                      </>
                    ) : null}
                    <TouchableOpacity
                      onPress={
                        editingGroupProfile
                          ? requestExitProfileEdit
                          : () => {
                              setDescExpanded(false);
                              setEditingGroupProfile(true);
                            }
                      }
                      style={styles.groupProfileEditBtn}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={editingGroupProfile ? 'Stop editing group' : 'Edit group name and description'}
                    >
                      <Ionicons
                        name={editingGroupProfile ? 'close' : 'create-outline'}
                        size={20}
                        color={Colors.textSub}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {canOpenGroupSettings ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push(`/(tabs)/groups/${groupId}/settings` as Href)
                    }
                    style={styles.groupProfileEditBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Group settings"
                  >
                    <Ionicons name="settings-outline" size={20} color={Colors.textSub} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            {canEditMain && editingGroupProfile ? (
              <View style={styles.groupEditFieldBlock}>
                <Text style={formSectionTitleStyle}>Group name</Text>
                <View style={styles.groupEditInputShell}>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Group name"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.groupTitleInputEdit}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>
            ) : (
              <Text
                style={[styles.groupTitleReadOnly, !group.name.trim() && styles.readOnlyPlaceholder]}
                numberOfLines={3}
              >
                {group.name.trim() ? group.name : 'No name'}
              </Text>
            )}
            {!isPending &&
            (group.membershipStatus === 'member' || group.membershipStatus === 'admin') &&
            !(canEditMain && editingGroupProfile) ? (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/(tabs)/groups/${groupId}/members` as Href)
                }
                style={styles.membersPreviewBtn}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={membersPreviewSubLabel}
              >
                <View style={styles.membersPreviewAvatars}>
                  {(group.memberIds ?? []).slice(0, 3).map((memberId, i) => {
                    const u = getUser(memberId);
                    return (
                      <View
                        key={u.id}
                        style={[styles.membersPreviewAvatarRing, i > 0 && styles.membersPreviewAvatarOverlap]}
                      >
                        <UserAvatar
                          seed={u.displayName || u.name}
                          backgroundColor={[u.avatarSeed]}
                          thumbnail={u.thumbnail}
                          size={22}
                        />
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.membersPreviewCount}>
                  {membersPreviewSubLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            {canEditMain && editingGroupProfile ? (
              <View style={[styles.groupEditFieldBlock, styles.groupDescEditFieldBlock]}>
                <Text style={formSectionTitleStyle}>Description</Text>
                <View style={[styles.groupEditInputShell, styles.groupEditDescShell]}>
                  <TextInput
                    value={draftDesc}
                    onChangeText={setDraftDesc}
                    placeholder="Optional description for your group"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.groupDescInputEdit}
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.groupDescField}>
                <View style={styles.groupDescBoxReadOnly}>
                  <Text
                    style={[
                      styles.groupDescText,
                      !group.desc?.trim() && styles.readOnlyPlaceholder,
                    ]}
                    numberOfLines={descNeedsReadMore && !descExpanded ? 2 : undefined}
                  >
                    {group.desc?.trim() ? group.desc : 'No description'}
                  </Text>
                  {descNeedsReadMore ? (
                    <TouchableOpacity
                      onPress={() => setDescExpanded((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={descExpanded ? 'Read less' : 'Read more'}
                    >
                      <Text style={styles.readMoreLink}>{descExpanded ? 'Read less' : 'Read more'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          </View>

          {!isPending && inviteCode ? (
            <View style={[styles.inviteSection, styles.inviteSectionInset]}>
              <View style={[styles.inviteRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 4 }]}>
                <Text style={styles.inviteLabel}>Invite code</Text>
                <View style={styles.inviteValueRow}>
                  {(isAdmin || isOwner) && (
                    <TouchableOpacity
                      onPress={confirmRegenerateInviteCode}
                      disabled={regenerateInviteCodeMutation.isPending || !currentUserId}
                      style={styles.regenerateInviteIconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Generate new invite code"
                    >
                      {regenerateInviteCodeMutation.isPending ? (
                        <ActivityIndicator size="small" color={Colors.textMuted} />
                      ) : (
                        <Ionicons name="refresh-outline" size={20} color={Colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  )}
                  <Text style={styles.inviteValue}>{inviteCode}</Text>
                  <TouchableOpacity
                    onPress={copyInviteCode}
                    style={styles.copyIconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={styles.copyIconWrap}>
                      {inviteCopied ? (
                        <Ionicons name="checkmark" size={18} color={Colors.going} />
                      ) : (
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Rect x="9" y="9" width="13" height="13" rx="2" />
                          <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </Svg>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
          </View>
        </View>

        {groupPhotosBlock}

        {isPending ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}>
            <View style={[styles.card, styles.cardPendingNotice, { padding: 24, alignItems: 'center' }]}>
              <Ionicons name="hourglass-outline" size={28} color="#92400E" style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.text, marginBottom: 8 }}>
                Request pending
              </Text>
              <Text style={{ fontSize: 14, color: Colors.textSub, textAlign: 'center', marginBottom: 16 }}>
                Your request to join {group.name} is pending approval. You'll see events and members once an admin approves.
              </Text>
              <TouchableOpacity onPress={() => setShowLeave(true)}>
                <Text style={{ fontSize: 14, color: Colors.textSub, textDecorationLine: 'underline' }}>Cancel request</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 16 }} />
            <Text style={styles.sectionLabel}>LEAVE</Text>
            <View style={[styles.card, styles.cardDanger]}>
              <TouchableOpacity onPress={() => setShowLeave(true)} style={styles.memberRow} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={22} color={Colors.textSub} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaveTitle}>Cancel Request</Text>
                  <Text style={styles.leaveDesc}>Withdraw your request to join this group</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}>
          {fetchGroupWeekEvents ? (
            <>
              <Text style={styles.sectionLabel}>ACTIVITIES</Text>
              <View style={[styles.card, { marginBottom: 16 }]}>
                <TouchableOpacity
                  onPress={() =>
                    router.push(`/(tabs)/groups/${groupId}/events` as Href)
                  }
                  style={[styles.memberRow, styles.rowBorder]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open events timeline"
                >
                  <Ionicons name="calendar-outline" size={22} color={Colors.textSub} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>Events</Text>
                    <Text style={styles.memberHandle}>
                      {groupEventsSummaryButtonLine
                        ? groupEventsSummaryButtonLine
                        : 'Events for this group'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    router.push(`/(tabs)/groups/${groupId}/polls` as Href)
                  }
                  style={[styles.memberRow, styles.rowBorder]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open group polls"
                >
                  <Ionicons name="bar-chart-outline" size={22} color={Colors.textSub} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>Polls</Text>
                    <Text style={styles.memberHandle}>
                      Polls for this group; vote and view results
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    router.push(`/(tabs)/groups/${groupId}/forum` as Href)
                  }
                  style={styles.memberRow}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open group posts"
                >
                  <Ionicons name="chatbubbles-outline" size={22} color={Colors.textSub} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>Posts</Text>
                    <Text style={styles.memberHandle}>
                      Posts, reactions, comments, and threaded replies
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          {group.membershipStatus !== 'none' && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>DANGER ZONE</Text>
              <View style={[styles.card, styles.cardDanger]}>
                {isOwner ? (
                  <>
                    {isSoftDeleted ? (
                      <TouchableOpacity onPress={doRecover} style={styles.memberRow} activeOpacity={0.8} disabled={recoverMutation.isPending}>
                        <Ionicons name="arrow-undo-outline" size={22} color={Colors.going} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.leaveTitle}>Recover Group</Text>
                          <Text style={styles.leaveDesc}>Restore this deactivated group</Text>
                        </View>
                        {recoverMutation.isPending && <ActivityIndicator size="small" color={Colors.text} />}
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity onPress={() => setShowDeactivateConfirm(true)} style={[styles.memberRow, styles.rowBorder]} activeOpacity={0.8} disabled={softDeleteMutation.isPending}>
                          <View style={styles.dangerIconWrap}><Ionicons name="pause-circle-outline" size={22} color="#B45309" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.leaveTitle, { color: '#B45309' }]}>Deactivate Group</Text>
                            <Text style={styles.leaveDesc}>Temporarily deactivate the group - you can recover it later</Text>
                          </View>
                          {softDeleteMutation.isPending && <ActivityIndicator size="small" color={Colors.text} />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={styles.memberRow} activeOpacity={0.8} disabled={hardDeleteMutation.isPending}>
                          <View style={styles.dangerIconWrap}><Ionicons name="trash-outline" size={22} color={Colors.notGoing} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.leaveTitle}>Delete Group</Text>
                            <Text style={styles.leaveDesc}>Permanently remove the group and all members</Text>
                          </View>
                          {hardDeleteMutation.isPending && <ActivityIndicator size="small" color={Colors.text} />}
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setShowLeave(true)} style={styles.memberRow} activeOpacity={0.8}>
                    <Ionicons name="log-out-outline" size={22} color={Colors.textSub} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaveTitle}>Leave Group</Text>
                      <Text style={styles.leaveDesc}>You'll need an invite to rejoin</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
          </>
          )}
        </View>
        )}
      </KeyboardSafeScrollView>

      <ImageLightboxModal
        visible={groupPhotoLightbox !== null}
        urls={groupPhotoLightbox?.urls ?? []}
        index={groupPhotoLightbox?.index ?? 0}
        onChangeIndex={(nextIndex) =>
          setGroupPhotoLightbox((prev) => (prev ? { ...prev, index: nextIndex } : prev))
        }
        onClose={() => setGroupPhotoLightbox(null)}
        headerAvatar={<Avatar name={group.name} size={28} />}
        title={group.name}
        subtitle={
          groupPhotoLightbox
            ? groupPhotoLightbox.urls.length > 1
              ? `Cover photos · ${groupPhotoLightbox.index + 1} of ${groupPhotoLightbox.urls.length}`
              : 'Cover photo'
            : undefined
        }
      />

      <AvatarPickerModal
        variant="group"
        visible={showAvatarPicker}
        onRequestClose={dismissAvatarPicker}
        onAfterSave={() => setShowAvatarPicker(false)}
        seed={avatarSeedDraft}
        onSeedChange={setAvatarSeedDraft}
        thumbnail={avatarThumbnailDraft}
        onThumbnailChange={setAvatarThumbnailDraft}
        userId={currentUserId ?? ''}
        onSave={async (avatarSeed, thumbnail) => {
          try {
            await updateGroup.mutateAsync({
              avatarSeed: avatarSeed.trim() === 'auto' || avatarSeed.trim() === '' ? null : avatarSeed.trim(),
              thumbnail: thumbnail ?? null,
              updatedBy: currentUserId ?? '',
            });
            const prior = thumbnailAtPickerOpenRef.current?.trim() ?? '';
            const saved = (thumbnail ?? '').trim();
            if (prior && /^https?:\/\//i.test(prior) && prior !== saved && currentUserId) {
              deleteManagedUploadFireAndForget(currentUserId, prior);
            }
          } catch (e) {
            if (Platform.OS === 'web') window.alert('Failed to update avatar');
            else Alert.alert('Error', 'Failed to update avatar');
            throw e;
          }
        }}
        isSaving={updateGroup.isPending}
      />

      {/* Leave confirm */}
      {showLeave && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowLeave(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowLeave(false)} activeOpacity={1}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>
                {isPending ? `Cancel request to join ${group.name}?` : `Leave ${group.name}?`}
              </Text>
              <Text style={styles.confirmBody}>
                {isPending
                  ? "You'll need an invite to request again."
                  : "You'll need an invite to rejoin."
                }
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowLeave(false)} style={[styles.confirmBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <Text style={{ fontFamily: Fonts.semiBold, color: Colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowLeave(false); leaveGroup(); }} style={[styles.confirmBtn, { backgroundColor: Colors.notGoing, borderColor: Colors.notGoing }]}>
                  <Text style={{ fontFamily: Fonts.bold, color: '#fff' }}>{isPending ? 'Cancel Request' : 'Leave'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Deactivate confirm (owner) */}
      {showDeactivateConfirm && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDeactivateConfirm(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowDeactivateConfirm(false)} activeOpacity={1}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Deactivate {group.name}?</Text>
              <Text style={styles.confirmBody}>
                You can recover this group at any time.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowDeactivateConfirm(false)} style={[styles.confirmBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <Text style={{ fontFamily: Fonts.semiBold, color: Colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doSoftDelete} style={[styles.confirmBtn, { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]} disabled={softDeleteMutation.isPending}>
                  <Text style={{ fontFamily: Fonts.bold, color: '#fff' }}>Deactivate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Delete confirm (owner) */}
      {showDeleteConfirm && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowDeleteConfirm(false)} activeOpacity={1}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete {group.name}?</Text>
              <Text style={styles.confirmBody}>
                This will permanently remove the group. This cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={[styles.confirmBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <Text style={{ fontFamily: Fonts.semiBold, color: Colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doHardDelete} style={[styles.confirmBtn, { backgroundColor: Colors.notGoing, borderColor: Colors.notGoing }]} disabled={hardDeleteMutation.isPending}>
                  <Text style={{ fontFamily: Fonts.bold, color: '#fff' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showAnnouncementReadModal ? (
        <Modal visible animationType="slide" onRequestClose={closeAnnouncementModal}>
          <SafeAreaView style={styles.membersModalWrap} edges={['top', 'left', 'right', 'bottom']}>
            <KeyboardFormRoot style={styles.announcementModalKeyboard}>
              <View style={styles.membersModalHeader}>
                <Text
                  style={[styles.membersModalTitle, { flex: 1, marginRight: 8 }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  accessibilityRole="header"
                >
                  {`Announcement @ ${group.name}`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {canEditAnnouncement && !editingAnnouncement ? (
                    <TouchableOpacity
                      onPress={() => {
                        setDraftAnnouncement(group.announcement ?? '');
                        setEditingAnnouncement(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Edit announcement"
                    >
                      <Text style={styles.announcementModalEditHeader}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={closeAnnouncementModal}
                    style={styles.membersModalClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close announcement"
                  >
                    <Ionicons name="close" size={26} color={Colors.textSub} />
                  </TouchableOpacity>
                </View>
              </View>
              <KeyboardSafeScrollView style={styles.membersModalScroll}>
                <View style={styles.membersModalCardWrap}>
                  {editingAnnouncement ? (
                    <>
                      <View style={styles.announcementInputWrapper}>
                        <TextInput
                          value={draftAnnouncement}
                          onChangeText={setDraftAnnouncement}
                          placeholder="Announcement for all members…"
                          placeholderTextColor={Colors.textMuted}
                          style={styles.announcementInput}
                          multiline
                          scrollEnabled
                          textAlignVertical="top"
                          underlineColorAndroid="transparent"
                        />
                      </View>
                      <View style={styles.announcementEditActions}>
                        <TouchableOpacity
                          onPress={cancelAnnouncementEdit}
                          disabled={updateGroup.isPending}
                          style={[styles.announcementEditActionBtn, styles.announcementEditActionBtnSecondary]}
                        >
                          <Text style={styles.announcementEditActionBtnTextSecondary}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void saveAnnouncement()}
                          disabled={updateGroup.isPending}
                          style={[styles.announcementEditActionBtn, styles.announcementEditActionBtnPrimary]}
                        >
                          {updateGroup.isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.announcementEditActionBtnTextPrimary}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (group.announcement ?? '').trim() ? (
                    <Text style={styles.announcementModalBodyText} selectable>
                      {(group.announcement ?? '').trim()}
                    </Text>
                  ) : (
                    <Text style={styles.announcementModalEmptyText}>
                      Nothing to see here ...
                    </Text>
                  )}
                </View>
              </KeyboardSafeScrollView>
            </KeyboardFormRoot>
          </SafeAreaView>
        </Modal>
      ) : null}

    </>
  );

  return <View style={styles.page}>{scrollAndOverlays}</View>;
}

const styles = StyleSheet.create({
  page:             { flex: 1, backgroundColor: Colors.bg },
  groupScrollView:  { flex: 1, backgroundColor: Colors.bg },
  groupScrollContent: { flexGrow: 1, backgroundColor: Colors.bg, paddingBottom: 8 },
  groupMainCardWrap:{ marginHorizontal: 20, marginTop: 10, marginBottom: 4 },
  groupPhotosSectionWrap: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  groupMainCard:    { backgroundColor: Colors.surface, borderRadius: Radius['2xl'], overflow: 'hidden' },
  groupProfileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupProfileTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  groupProfileEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: -2,
  },
  groupProfileEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  requiredMark: { color: Colors.todayRed, fontFamily: Fonts.semiBold },
  groupEditFieldBlock: { marginBottom: 12 },
  groupDescEditFieldBlock: { marginTop: 10 },
  groupEditInputShell: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  groupEditDescShell: {
    minHeight: 132,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  groupTitleInputEdit: {
    width: '100%',
    minHeight: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    lineHeight: 24,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : null),
  },
  groupDescInputEdit: {
    width: '100%',
    minHeight: 108,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : null),
  },
  groupTitleReadOnly: {
    fontSize: 21,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 4,
  },
  readOnlyPlaceholder: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
  },
  groupDescField: { marginTop: 10 },
  groupDescBoxReadOnly: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginTop: 4,
    marginBottom: 16,
  },
  readMoreLink: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.accent,
  },
  groupDescText:    { fontSize: 14, color: Colors.text, fontFamily: Fonts.regular, lineHeight: 22 },
  groupPhotosAddCard: {
    backgroundColor: Colors.bg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupPhotosAddCardNested: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  groupPhotosAddBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  coverRemoveThumb: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.text,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupThumb:       { width: AVATAR_SIZE, height: AVATAR_SIZE, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inviteSection:    { marginTop: 0, paddingBottom: 0 },
  inviteSectionInset: { paddingHorizontal: 16, paddingBottom: 16 },
  inviteRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inviteLabel:      { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted, opacity: 0.65 },
  inviteValueRow:   { flexDirection: 'row', alignItems: 'center', gap: 0, flexWrap: 'wrap' },
  inviteValue:      { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textMuted, opacity: 0.65 },
  regenerateInviteIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyIconBtn:      { padding: 4 },
  copyIconWrap:     { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  copyIconText:     { fontSize: 16, fontFamily: Fonts.bold },
  card:             { backgroundColor: Colors.surface, borderRadius: Radius['2xl'], overflow: 'hidden' },
  cardPendingNotice:{ backgroundColor: '#FFFBEB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A' },
  cardDanger:       { borderWidth: StyleSheet.hairlineWidth, borderColor: '#FECACA' },
  sectionLabel:     {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionLabelSpaced: { marginTop: 24 },
  pendingCard:      { borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A', marginBottom: 16 },
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder:        { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberName:       { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  memberNameMe:     { color: Colors.going },
  memberHandle:     { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  youLabel:         { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  memberRole:       { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  adminBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  adminBadgeText:   { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSub },
  approveBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, backgroundColor: Colors.going },
  approveBtnText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fff' },
  declineBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  declineBtnText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  leaveTitle:       { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  leaveDesc:        { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  menuOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  menuCard:         { backgroundColor: Colors.surface, borderRadius: 16, width: 220, overflow: 'hidden', ...Shadows.lg },
  menuHeader:       { padding: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuHeaderText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted },
  menuItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 16 },
  menuItemText:     { fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  confirmCard:      { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, ...Shadows.lg },
  confirmTitle:     { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 8 },
  confirmBody:      { fontSize: 14, color: Colors.textSub, fontFamily: Fonts.regular, lineHeight: 22, marginBottom: 20 },
  confirmBtn:       { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
  dangerIconWrap:   { width: 28, alignItems: 'center', justifyContent: 'center' },
  groupPhotoLightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPhotoLightboxHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  groupPhotoLightboxName: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#fff' },
  groupPhotoLightboxSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Fonts.regular,
  },
  groupPhotoLightboxClose: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  groupPhotoLightboxImg: { width: '100%', height: '70%' },
  groupPhotoLightboxNavBtn: {
    position: 'absolute',
    top: '42%',
    zIndex: 2,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPhotoLightboxNavBtnDisabled: { opacity: 0.28 },
  groupPhotoLightboxNavPrev: { left: 10 },
  groupPhotoLightboxNavNext: { right: 10 },
  membersPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: 'transparent',
    maxWidth: '100%',
  },
  membersPreviewAvatars: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  membersPreviewAvatarRing: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    overflow: 'hidden',
  },
  membersPreviewAvatarOverlap: { marginLeft: -9 },
  membersPreviewCount: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  membersModalWrap: { flex: 1, backgroundColor: Colors.bg },
  membersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  membersModalTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text, flexShrink: 1 },
  membersModalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  membersModalScroll: { flex: 1 },
  membersModalCardWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  announcementSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  announcementModalKeyboard: { flex: 1 },
  announcementModalEditHeader: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.accent,
    paddingRight: 4,
  },
  announcementModalBodyText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 24,
  },
  announcementModalEmptyText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  announcementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  announcementRowHasContent: {
    backgroundColor: Colors.maybeBg,
    borderColor: Colors.maybeBorder,
  },
  announcementRowLeadingIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  announcementTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  announcementRowText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 20,
  },
  announcementRowTextEmphasis: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#92400E',
    lineHeight: 20,
  },
  announcementRowPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  announcementEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  announcementEditActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Radius.lg,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementEditActionBtnSecondary: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  announcementEditActionBtnPrimary: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  announcementEditActionBtnTextSecondary: {
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    fontSize: 14,
  },
  announcementEditActionBtnTextPrimary: {
    fontFamily: Fonts.semiBold,
    color: '#fff',
    fontSize: 14,
  },
  announcementInputWrapper: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    minHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  announcementInput: {
    width: '100%',
    minHeight: 96,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 22,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : null),
  },
});
