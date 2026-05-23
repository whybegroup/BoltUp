import type { Href, Router } from 'expo-router';

const DEFAULT_UNLOCK_MS = 900;

let navigationBusy = false;
let guardBatchDepth = 0;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

export function resetNavigationLocks(): void {
  navigationBusy = false;
  guardBatchDepth = 0;
  if (unlockTimer) {
    clearTimeout(unlockTimer);
    unlockTimer = null;
  }
}

function scheduleUnlock(ms: number): void {
  if (unlockTimer) clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => {
    navigationBusy = false;
    unlockTimer = null;
  }, ms);
}

/** Runs one or more navigation calls under a single lock (e.g. replace then push). */
export function runGuardedNavigation(actions: () => void, unlockMs = DEFAULT_UNLOCK_MS): void {
  if (navigationBusy && guardBatchDepth === 0) return;
  if (guardBatchDepth === 0) navigationBusy = true;
  guardBatchDepth += 1;
  try {
    actions();
  } finally {
    guardBatchDepth -= 1;
    if (guardBatchDepth === 0) scheduleUnlock(unlockMs);
  }
}

export function guardedRouterPush(router: Pick<Router, 'push'>, href: Href): void {
  if (guardBatchDepth > 0) {
    router.push(href);
    return;
  }
  runGuardedNavigation(() => router.push(href));
}

export function guardedRouterReplace(router: Pick<Router, 'replace'>, href: Href): void {
  if (guardBatchDepth > 0) {
    router.replace(href);
    return;
  }
  runGuardedNavigation(() => router.replace(href));
}

export function guardedRouterDismissTo(router: Pick<Router, 'dismissTo'>, href: Href): void {
  if (guardBatchDepth > 0) {
    router.dismissTo(href);
    return;
  }
  runGuardedNavigation(() => router.dismissTo(href));
}
