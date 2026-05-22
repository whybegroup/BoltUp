import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter, usePathname } from 'expo-router';
import { PushTokenInput, UsersService } from '@moijia/client';
import { queryClient } from '../config/queryClient';
import { navigateFromNotificationPayload } from '../utils/notificationNavigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

function pushPayloadFromResponse(
  response: Notifications.NotificationResponse
): Record<string, string | undefined> {
  const data = response.notification.request.content.data;
  if (!data || typeof data !== 'object') return {};
  return data as Record<string, string | undefined>;
}

async function resolveExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    console.warn(
      'Push notifications need EXPO_PUBLIC_EAS_PROJECT_ID (or extra.eas.projectId in app.config).'
    );
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export function usePushNotifications(userId: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId) return;

    let cancelled = false;

    const register = async () => {
      try {
        const token = await resolveExpoPushToken();
        if (cancelled || !token || token === registeredTokenRef.current) return;
        registeredTokenRef.current = token;
        const platform =
          Platform.OS === 'ios' ? PushTokenInput.platform.IOS : PushTokenInput.platform.ANDROID;
        await UsersService.registerPushToken(userId, {
          token,
          platform,
          deviceId: Device.modelName ?? undefined,
        });
      } catch {
        registeredTokenRef.current = null;
      }
    };

    void register();

    return () => {
      cancelled = true;
      const token = registeredTokenRef.current;
      registeredTokenRef.current = null;
      if (token) {
        void UsersService.unregisterPushToken(userId, token).catch(() => undefined);
      }
    };
  }, [userId]);

  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const responseId = lastResponse.notification.request.identifier;
    if (handledResponseIdRef.current === responseId) return;
    handledResponseIdRef.current = responseId;

    const data = pushPayloadFromResponse(lastResponse);
    navigateFromNotificationPayload(router, pathname, {
      dest: data.dest,
      eventId: data.eventId,
      groupId: data.groupId,
      pollId: data.pollId,
      navigable: !!(data.groupId || data.eventId || data.pollId),
    });
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [lastResponse, router, pathname, userId]);
}
