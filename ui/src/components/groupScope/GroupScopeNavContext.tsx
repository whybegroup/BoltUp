import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GroupSubpage } from './useGroupSubpage';

type GroupScopeNavContextValue = {
  optimisticSubpage: GroupSubpage | null;
  setOptimisticSubpage: (subpage: GroupSubpage | null) => void;
  /** Breadcrumb/header show All Groups before pathname catches up on dismiss. */
  optimisticAllGroups: boolean;
  setOptimisticAllGroups: (value: boolean) => void;
};

const GroupScopeNavContext = createContext<GroupScopeNavContextValue | null>(null);

export function GroupScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticSubpage, setOptimisticSubpage] = useState<GroupSubpage | null>(null);
  const [optimisticAllGroups, setOptimisticAllGroups] = useState(false);

  const value = useMemo(
    () => ({
      optimisticSubpage,
      setOptimisticSubpage,
      optimisticAllGroups,
      setOptimisticAllGroups,
    }),
    [optimisticSubpage, optimisticAllGroups]
  );

  return <GroupScopeNavContext.Provider value={value}>{children}</GroupScopeNavContext.Provider>;
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
