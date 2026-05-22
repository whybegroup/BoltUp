import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

/** Registers Expo push tokens and handles notification tap navigation (native only). */
export function PushNotificationsRegistrar() {
  const { user } = useAuth();
  usePushNotifications(user?.uid ?? null);
  return null;
}
