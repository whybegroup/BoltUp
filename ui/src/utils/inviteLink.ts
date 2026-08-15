export const INVITE_LINK_ORIGIN = 'https://moijia.com';

export function groupInvitePath(inviteCode: string): string {
  return `/join/${inviteCode.trim()}`;
}

export function groupInviteLink(inviteCode: string): string {
  return `${INVITE_LINK_ORIGIN}${groupInvitePath(inviteCode)}`;
}
