import { INVITE_LINK_ORIGIN } from './inviteLink';

export function eventSharePath(eventId: string): string {
  return `/event/${eventId.trim()}`;
}

export function eventShareLink(eventId: string): string {
  return `${INVITE_LINK_ORIGIN}${eventSharePath(eventId)}`;
}

export function pollSharePath(pollId: string): string {
  return `/poll/${pollId.trim()}`;
}

export function pollShareLink(pollId: string): string {
  return `${INVITE_LINK_ORIGIN}${pollSharePath(pollId)}`;
}

export function postSharePath(groupId: string, postId: string): string {
  return `/groups/${groupId.trim()}/forum?postId=${encodeURIComponent(postId.trim())}`;
}

export function postShareLink(groupId: string, postId: string): string {
  return `${INVITE_LINK_ORIGIN}${postSharePath(groupId, postId)}`;
}
