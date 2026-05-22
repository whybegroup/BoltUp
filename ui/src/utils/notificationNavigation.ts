import type { Router } from 'expo-router';
import { Notification } from '@moijia/client';
import { withReturnTo } from './navigationReturn';

export type NotificationNavPayload = {
  dest?: string | null;
  eventId?: string | null;
  groupId?: string | null;
  pollId?: string | null;
  navigable?: boolean;
};

export function navigateFromNotificationPayload(
  router: Router,
  pathname: string,
  payload: NotificationNavPayload
): void {
  if (payload.navigable === false) return;
  const dest = payload.dest;
  if (dest === Notification.dest.EVENT && payload.eventId) {
    router.push(withReturnTo(`/event/${payload.eventId}`, pathname));
  } else if (dest === Notification.dest.GROUP && payload.groupId) {
    router.push(withReturnTo(`/(tabs)/groups/${payload.groupId}`, pathname));
  } else if (dest === Notification.dest.POLL && payload.pollId) {
    if (payload.groupId) {
      router.push(
        withReturnTo(`/(tabs)/groups/${payload.groupId}/polls/${payload.pollId}`, pathname)
      );
    } else {
      router.push(withReturnTo(`/poll/${payload.pollId}`, pathname));
    }
  }
}

export function navigateFromNotification(
  router: Router,
  pathname: string,
  n: Pick<Notification, 'dest' | 'eventId' | 'groupId' | 'pollId' | 'navigable'>
): void {
  navigateFromNotificationPayload(router, pathname, n);
}
