import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from './useAppRouter';
import { useJoinGroup } from './api/useGroups';
import type { NotGroupMemberInfo } from '../utils/apiErrors';
import { showJoinGroupToast } from '../utils/joinGroupToast';

export type ShareLinkKind = 'event' | 'poll' | 'post';

function kindLabel(kind: ShareLinkKind): string {
  return kind;
}

function askToJoin(
  info: NotGroupMemberInfo,
  kind: ShareLinkKind,
  onJoin: () => void,
  onDismiss: () => void
) {
  const viewLabel = kindLabel(kind);
  if (info.membershipStatus === 'pending') {
    const msg = `Your request to join ${info.groupName} is pending approval. You'll be able to view this ${viewLabel} once an admin approves.`;
    if (Platform.OS === 'web') {
      window.alert(msg);
      onDismiss();
      return;
    }
    Alert.alert('Request pending', msg, [{ text: 'OK', onPress: onDismiss }]);
    return;
  }

  const title = `Join ${info.groupName}?`;
  const message = info.requireApprovalToJoin
    ? `You're not a member of this group. Request to join to view this ${viewLabel}?`
    : `You're not a member of this group. Join to view this ${viewLabel}?`;
  const confirmLabel = info.requireApprovalToJoin ? 'Request to join' : 'Join';

  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onJoin();
    else onDismiss();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel', onPress: onDismiss },
    { text: confirmLabel, onPress: onJoin },
  ]);
}

export function useShareLinkJoinPrompt(opts: {
  kind: ShareLinkKind;
  userId: string | null | undefined;
  joinInfo: NotGroupMemberInfo | null;
  onDismiss: () => void;
  onJoined: () => void;
}) {
  const { kind, userId, joinInfo, onDismiss, onJoined } = opts;
  const router = useRouter();
  const joinGroup = useJoinGroup();
  const shownKeyRef = useRef<string | null>(null);
  const joinInfoRef = useRef(joinInfo);
  const onDismissRef = useRef(onDismiss);
  const onJoinedRef = useRef(onJoined);
  joinInfoRef.current = joinInfo;
  onDismissRef.current = onDismiss;
  onJoinedRef.current = onJoined;

  useEffect(() => {
    if (!joinInfo || !userId) return;
    const key = `${kind}:${joinInfo.groupId}:${joinInfo.membershipStatus}`;
    if (shownKeyRef.current === key) return;
    shownKeyRef.current = key;

    const runJoin = () => {
      const info = joinInfoRef.current;
      if (!info) return;
      joinGroup.mutate(
        { groupId: info.groupId, userId },
        {
          onSuccess: (data) => {
            const name = data.groupName || info.groupName;
            showJoinGroupToast({
              groupName: name,
              status: data.status,
              alreadyMember: data.alreadyMember,
            });
            if (data.status === 'joined') {
              onJoinedRef.current();
              return;
            }
            router.replace(`/(tabs)/groups/${info.groupId}` as Href);
          },
          onError: (e: unknown) => {
            shownKeyRef.current = null;
            const err = e as { body?: { error?: string }; message?: string };
            const msg = err?.body?.error ?? err?.message ?? 'Could not join the group';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('Could not join', msg);
          },
        }
      );
    };

    askToJoin(joinInfo, kind, runJoin, () => onDismissRef.current());
  }, [joinInfo, kind, joinGroup, router, userId]);
}
