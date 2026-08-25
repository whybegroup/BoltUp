import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import type { Notification as ApiNotification } from '@moijia/client';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { useNotifications } from '../hooks/api';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { navigateFromNotificationPayload } from '../utils/notificationNavigation';
import { NotificationListIcon } from './NotificationListIcon';

const SHOW_MS = 5000;
const SLIDE = 14;

type Banner = {
  id: string;
  title: string;
  body: string;
  type: string;
  dest?: string;
  eventId?: string;
  groupId?: string;
  pollId?: string;
  postId?: string;
  commentId?: string;
};

function bannerFromPush(notification: Notifications.Notification): Banner | null {
  const { title, body, data } = notification.request.content;
  const heading = (title ?? '').trim();
  const detail = (body ?? '').trim();
  if (!heading && !detail) return null;
  const payload = (data && typeof data === 'object' ? data : {}) as Record<string, string | undefined>;
  return {
    id: payload.notificationId || notification.request.identifier,
    title: heading || 'Notification',
    body: detail,
    type: payload.type ?? '',
    dest: payload.dest,
    eventId: payload.eventId,
    groupId: payload.groupId,
    pollId: payload.pollId,
    postId: payload.postId,
    commentId: payload.commentId,
  };
}

function bannerFromApi(n: ApiNotification): Banner {
  return {
    id: n.id,
    title: (n.title ?? '').trim() || 'Notification',
    body: (n.body ?? '').trim(),
    type: n.type ?? '',
    dest: n.dest ?? undefined,
    eventId: n.eventId ?? undefined,
    groupId: n.groupId ?? undefined,
    pollId: n.pollId ?? undefined,
    postId: n.postId ?? undefined,
    commentId: n.commentId ?? undefined,
  };
}

export function ForegroundNotificationBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useCurrentUserContext();
  const { data: notifs = [], isFetched } = useNotifications(userId ?? undefined);
  const [banner, setBanner] = useState<Banner | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-SLIDE)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showRef = useRef<(next: Banner) => void>(() => undefined);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const shownIdsRef = useRef(new Set<string>());

  const hide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -SLIDE, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setBanner(null);
    });
  };

  const show = (next: Banner) => {
    if (shownIdsRef.current.has(next.id)) return;
    shownIdsRef.current.add(next.id);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    opacity.setValue(0);
    translateY.setValue(-SLIDE);
    setBanner(next);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    hideTimer.current = setTimeout(hide, SHOW_MS);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };
  showRef.current = show;

  useEffect(() => {
    if (!userId) {
      seenIdsRef.current = null;
      shownIdsRef.current = new Set();
      return;
    }
    if (!isFetched) return;
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(notifs.map((n) => n.id));
      return;
    }
    const unseen = notifs.filter((n) => !seenIdsRef.current!.has(n.id));
    if (unseen.length === 0) return;
    for (const n of unseen) seenIdsRef.current.add(n.id);
    const newest = unseen.reduce((a, b) =>
      new Date(a.ts).getTime() >= new Date(b.ts).getTime() ? a : b
    );
    showRef.current(bannerFromApi(newest));
  }, [isFetched, notifs, userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const next = bannerFromPush(notification);
      if (next) showRef.current(next);
    });
    return () => {
      sub.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!banner) return null;

  const open = () => {
    const payload = banner;
    hide();
    requestAnimationFrame(() => {
      navigateFromNotificationPayload(router, pathname, {
        dest: payload.dest,
        eventId: payload.eventId,
        groupId: payload.groupId,
        pollId: payload.pollId,
        postId: payload.postId,
        commentId: payload.commentId,
        navigable: !!(payload.groupId || payload.eventId || payload.pollId || payload.postId),
      });
    });
  };

  return (
    <View
      pointerEvents="box-none"
      collapsable={false}
      style={[styles.layer, { paddingTop: Math.max(insets.top, 8) + 8 }]}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Pressable
          onPress={open}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          accessibilityRole="alert"
          accessibilityLabel={`${banner.title}. ${banner.body}`}
        >
          <View style={styles.iconWrap}>
            <NotificationListIcon type={banner.type} icon="" color={Colors.text} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>
              {banner.title}
            </Text>
            {banner.body ? (
              <Text style={styles.body} numberOfLines={2}>
                {banner.body}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 24,
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.lg,
    ...(Platform.OS === 'android' ? { elevation: 24 } : null),
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: Colors.text,
  },
  body: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSub,
  },
});
