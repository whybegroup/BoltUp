import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors, Fonts, Radius } from '../constants/theme';
import { Toggle } from './ui';
import { KeyboardSafeScrollView } from './KeyboardSafeScrollView';
import { useGroup, useUpdateGroup } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { GroupMemberThemeAndNotifications } from './GroupMemberThemeAndNotifications';
import { useMissingGroupRedirect } from '../hooks/useMissingResourceAlert';

export type GroupSettingsViewProps = {
  groupId: string;
};

export function GroupSettingsView({ groupId }: GroupSettingsViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError, error: groupError, refetch: refetchGroup } = useGroup(groupId, currentUserId ?? '');
  const updateGroup = useUpdateGroup(groupId, currentUserId ?? '');
  const { refreshControl } = usePullToRefresh(refetchGroup);

  useMissingGroupRedirect(isError, groupError, group?.membershipStatus, '/(tabs)/groups');

  useEffect(() => {
    if (group?.membershipStatus === 'pending') {
      router.replace(`/(tabs)/groups/${groupId}` as Href);
    }
  }, [group?.membershipStatus, groupId, router]);

  if (!group) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.textSub} />
      </View>
    );
  }

  const isOwner = (group.ownerId ?? '') === currentUserId;
  const isAdmin = group.membershipStatus === 'admin';
  const canOpen =
    !!currentUserId &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

  if (!canOpen) {
    return null;
  }

  return (
    <View style={styles.page}>
      <KeyboardSafeScrollView style={styles.scroll} refreshControl={refreshControl}>
        <View style={styles.content}>
          {isAdmin || isOwner ? (
            <>
              <Text style={styles.sectionLabel}>Group Privacy</Text>
              <View style={[styles.card, { marginBottom: 16 }]}>
                <Toggle
                  value={group.requireApprovalToJoin}
                  style={{ borderBottomWidth: 0, paddingHorizontal: 16 }}
                  onChange={async (v) => {
                    if (updateGroup.isPending) return;
                    try {
                      await updateGroup.mutateAsync({
                        requireApprovalToJoin: v,
                        updatedBy: currentUserId ?? '',
                      });
                    } catch {
                      if (Platform.OS === 'web') window.alert('Failed to update join approval setting');
                      else Alert.alert('Error', 'Failed to update join approval setting');
                    }
                  }}
                  label="Require approval to join?"
                />
              </View>
            </>
          ) : null}
          <GroupMemberThemeAndNotifications
            groupId={groupId}
            userId={currentUserId}
            groupName={group.name}
          />
        </View>
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: { backgroundColor: Colors.surface, borderRadius: Radius['2xl'], overflow: 'hidden' },
});
