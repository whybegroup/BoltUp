import type { Router } from 'expo-router';
import { Notification } from '@moijia/client';
import type { Href } from 'expo-router';
import { resetNavigationLocks, runGuardedNavigation } from './navigationGuard';
import { navigateToEventCommentMention, navigateToGroupForumMention } from './tabBreadcrumbNav';

export type NotificationNavPayload = {
  dest?: string | null;
  eventId?: string | null;
  groupId?: string | null;
  pollId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  navigable?: boolean;
};

export function navigateFromNotificationPayload(
  router: Router,
  pathname: string,
  payload: NotificationNavPayload
): void {
  if (payload.navigable === false) return;
  resetNavigationLocks();
  const dest = payload.dest;
  runGuardedNavigation(() => {
    if (payload.groupId && payload.postId) {
      navigateToGroupForumMention(
        router,
        pathname,
        payload.groupId,
        payload.postId,
        payload.commentId
      );
    } else if (payload.eventId && payload.commentId) {
      navigateToEventCommentMention(router, pathname, payload.eventId, payload.commentId);
    } else if (dest === Notification.dest.EVENT && payload.eventId) {
      router.push(`/(tabs)/events/${payload.eventId}` as Href);
    } else if (dest === Notification.dest.GROUP && payload.groupId) {
      router.push(`/(tabs)/groups/${payload.groupId}` as Href);
    } else if (dest === Notification.dest.POLL && payload.pollId) {
      router.push(`/(tabs)/polls/${payload.pollId}` as Href);
    }
  }, 1200);
}

export function navigateFromNotification(
  router: Router,
  pathname: string,
  n: Pick<
    Notification,
    'dest' | 'eventId' | 'groupId' | 'pollId' | 'postId' | 'commentId' | 'navigable'
  >
): void {
  navigateFromNotificationPayload(router, pathname, n);
}
