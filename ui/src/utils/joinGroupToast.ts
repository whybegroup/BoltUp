import Toast from 'react-native-toast-message';

export type JoinGroupResult = {
  groupName?: string | null;
  status?: string;
  alreadyMember?: boolean;
};

/** Success toast after joining. No toast if the user was already a member. */
export function showJoinGroupToast(data: JoinGroupResult | null | undefined): void {
  if (!data) return;
  if (data.status === 'joined' && data.alreadyMember) return;
  const name = data.groupName?.trim() || 'the group';
  Toast.show({
    type: 'success',
    text1:
      data.status === 'joined' ? `Joined ${name}` : `Submitted request to join ${name}`,
  });
}
