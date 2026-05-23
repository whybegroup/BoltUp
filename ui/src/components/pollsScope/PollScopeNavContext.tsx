import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type PollScopeNavContextValue = {
  optimisticAllPolls: boolean;
  setOptimisticAllPolls: (value: boolean) => void;
};

const PollScopeNavContext = createContext<PollScopeNavContextValue | null>(null);

export function PollScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticAllPolls, setOptimisticAllPolls] = useState(false);

  const value = useMemo(
    () => ({
      optimisticAllPolls,
      setOptimisticAllPolls,
    }),
    [optimisticAllPolls]
  );

  return <PollScopeNavContext.Provider value={value}>{children}</PollScopeNavContext.Provider>;
}

export function usePollScopeNav() {
  const ctx = useContext(PollScopeNavContext);
  if (!ctx) {
    throw new Error('usePollScopeNav must be used within PollScopeNavProvider');
  }
  return ctx;
}
