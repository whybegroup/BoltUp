import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from './useAppRouter';
import { isNotFoundError } from '../utils/apiErrors';

export type MissingResourceKind = 'event' | 'group' | 'poll' | 'post';

export function missingResourceMessage(kind: MissingResourceKind): string {
  return `This ${kind} no longer exists.`;
}

export function alertMissingResource(kind: MissingResourceKind, onDismiss?: () => void) {
  const msg = missingResourceMessage(kind);
  if (Platform.OS === 'web') {
    window.alert(msg);
    onDismiss?.();
    return;
  }
  Alert.alert(msg, undefined, [{ text: 'OK', onPress: onDismiss }]);
}

/** Shows a one-shot alert when `gone` becomes true, then runs `onGone`. */
export function useMissingResourceAlert(
  kind: MissingResourceKind,
  gone: boolean,
  onGone: () => void
) {
  const shownRef = useRef(false);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;

  useEffect(() => {
    if (!gone || shownRef.current) return;
    shownRef.current = true;
    alertMissingResource(kind, () => onGoneRef.current());
  }, [gone, kind]);
}

/** True when a React Query result is a 404 / missing resource. */
export function isMissingQueryError(isError: boolean, error: unknown): boolean {
  return isError && isNotFoundError(error);
}

/**
 * Group screens currently bounce away on fetch failure or `membershipStatus === 'none'`.
 * 404s get an alert first; other cases keep the silent redirect.
 */
export function useMissingGroupRedirect(
  isError: boolean,
  error: unknown,
  membershipStatus: string | undefined,
  fallbackHref: Href
) {
  const router = useRouter();
  const gone = isMissingQueryError(isError, error);

  useMissingResourceAlert('group', gone, () => router.replace(fallbackHref));

  useEffect(() => {
    if (gone) return;
    if (isError || membershipStatus === 'none') {
      router.replace(fallbackHref);
    }
  }, [gone, isError, membershipStatus, router, fallbackHref]);
}
