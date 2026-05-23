import { useState, useCallback, useMemo, useRef, type ReactElement } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { queryClient } from '../config/queryClient';
import { Colors } from '../constants/theme';

type RefreshFn = () => void | Promise<unknown>;

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Wait until no queries are fetching (safety net after refetch promises). */
function waitForQueriesToSettle(): Promise<void> {
  if (!queryClient.isFetching()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = queryClient.getQueryCache().subscribe(() => {
      if (!queryClient.isFetching()) {
        unsub();
        resolve();
      }
    });
    if (!queryClient.isFetching()) {
      unsub();
      resolve();
    }
  });
}

async function runRefreshFns(fns: RefreshFn[]): Promise<void> {
  await Promise.all(
    fns.map(async (fn) => {
      await fn();
    })
  );
  await waitForQueriesToSettle();
}

export function usePullToRefresh(
  onRefreshData: RefreshFn | RefreshFn[],
  options?: { enabled?: boolean },
) {
  const refreshEnabled = options?.enabled ?? true;
  const [refreshing, setRefreshing] = useState(false);
  const fnsRef = useRef<RefreshFn[]>([]);
  fnsRef.current = Array.isArray(onRefreshData) ? onRefreshData : [onRefreshData];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await waitForPaint();
    try {
      await runRefreshFns(fnsRef.current);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshControl = useMemo(
    (): ReactElement<RefreshControlProps> => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        enabled={refreshEnabled}
        tintColor={Colors.textSub}
        colors={[Colors.textSub]}
      />
    ),
    [refreshing, onRefresh, refreshEnabled]
  );

  return { refreshing, onRefresh, refreshControl };
}
