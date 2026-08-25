import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GroupSubpage } from './useGroupSubpage';
import type { ChromeHeaderSlotSetters, ChromeHeaderSlotState, ChromeHeaderTheme } from '../chromeHeaderTypes';

type GroupScopeNavContextValue = {
  optimisticSubpage: GroupSubpage | null;
  setOptimisticSubpage: (subpage: GroupSubpage | null) => void;
  /** Breadcrumb/header show All Groups before pathname catches up on dismiss. */
  optimisticAllGroups: boolean;
  setOptimisticAllGroups: (value: boolean) => void;
} & ChromeHeaderSlotSetters;

const GroupScopeNavContext = createContext<GroupScopeNavContextValue | null>(null);
const GroupScopeHeaderSlotContext = createContext<ChromeHeaderSlotState>({
  headerTrailing: null,
  headerTheme: null,
});

export function GroupScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticSubpage, setOptimisticSubpage] = useState<GroupSubpage | null>(null);
  const [optimisticAllGroups, setOptimisticAllGroups] = useState(false);
  const [headerTrailing, setHeaderTrailing] = useState<ReactNode | null>(null);
  const [headerTheme, setHeaderTheme] = useState<ChromeHeaderTheme | null>(null);

  const value = useMemo(
    () => ({
      optimisticSubpage,
      setOptimisticSubpage,
      optimisticAllGroups,
      setOptimisticAllGroups,
      setHeaderTrailing,
      setHeaderTheme,
    }),
    [optimisticSubpage, optimisticAllGroups]
  );

  const slot = useMemo(
    () => ({ headerTrailing, headerTheme }),
    [headerTrailing, headerTheme]
  );

  return (
    <GroupScopeNavContext.Provider value={value}>
      <GroupScopeHeaderSlotContext.Provider value={slot}>{children}</GroupScopeHeaderSlotContext.Provider>
    </GroupScopeNavContext.Provider>
  );
}

export function useGroupScopeNavOptional() {
  return useContext(GroupScopeNavContext);
}

export function useGroupScopeHeaderSlot() {
  return useContext(GroupScopeHeaderSlotContext);
}

export function useGroupScopeNav() {
  const ctx = useContext(GroupScopeNavContext);
  if (!ctx) {
    throw new Error('useGroupScopeNav must be used within GroupScopeNavProvider');
  }
  return ctx;
}

/** Clear optimistic subpage once pathname-derived subpage matches. */
export function useClearOptimisticSubpageWhenSynced(
  pathnameSubpage: GroupSubpage,
  optimisticSubpage: GroupSubpage | null,
  setOptimisticSubpage: (subpage: GroupSubpage | null) => void
) {
  const clearIfSynced = useCallback(() => {
    if (!optimisticSubpage) return;
    if (optimisticSubpage.kind !== pathnameSubpage.kind) return;
    if (optimisticSubpage.kind === 'poll' && pathnameSubpage.kind === 'poll') {
      if (optimisticSubpage.pollId !== pathnameSubpage.pollId) return;
    }
    setOptimisticSubpage(null);
  }, [optimisticSubpage, pathnameSubpage, setOptimisticSubpage]);

  return clearIfSynced;
}
