import { Platform } from 'react-native';

/**
 * Google Maps / Places API key from `.env`.
 * Prefer a dedicated Maps key; falls back to the platform Firebase API key
 * (same Google Cloud project) when unset.
 */
export function resolveGoogleMapsApiKey(): string {
  const dedicated = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (dedicated) return dedicated;

  switch (Platform.OS) {
    case 'ios':
      return (
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS?.trim() ||
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ||
        ''
      );
    case 'android':
      return (
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID?.trim() ||
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ||
        ''
      );
    default:
      return process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() || '';
  }
}
