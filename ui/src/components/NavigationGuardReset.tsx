import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { resetNavigationLocks } from '../utils/navigationGuard';

/** Clears navigation locks after route changes so back navigation stays responsive. */
export function NavigationGuardReset() {
  const pathname = usePathname();
  useEffect(() => {
    resetNavigationLocks();
  }, [pathname]);
  return null;
}
