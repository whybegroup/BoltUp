import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ChromeHeaderSlotSetters, ChromeHeaderSlotState, ChromeHeaderTheme } from '../chromeHeaderTypes';

type PollScopeNavContextValue = {
  optimisticAllPolls: boolean;
  setOptimisticAllPolls: (value: boolean) => void;
} & ChromeHeaderSlotSetters;

const PollScopeNavContext = createContext<PollScopeNavContextValue | null>(null);
const PollScopeHeaderSlotContext = createContext<ChromeHeaderSlotState>({
  headerTrailing: null,
  headerTheme: null,
});

export function PollScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticAllPolls, setOptimisticAllPolls] = useState(false);
  const [headerTrailing, setHeaderTrailing] = useState<ReactNode | null>(null);
  const [headerTheme, setHeaderTheme] = useState<ChromeHeaderTheme | null>(null);

  const value = useMemo(
    () => ({
      optimisticAllPolls,
      setOptimisticAllPolls,
      setHeaderTrailing,
      setHeaderTheme,
    }),
    [optimisticAllPolls]
  );

  const slot = useMemo(
    () => ({ headerTrailing, headerTheme }),
    [headerTrailing, headerTheme]
  );

  return (
    <PollScopeNavContext.Provider value={value}>
      <PollScopeHeaderSlotContext.Provider value={slot}>{children}</PollScopeHeaderSlotContext.Provider>
    </PollScopeNavContext.Provider>
  );
}

export function usePollScopeNavOptional() {
  return useContext(PollScopeNavContext);
}

export function usePollScopeHeaderSlot() {
  return useContext(PollScopeHeaderSlotContext);
}

export function usePollScopeNav() {
  const ctx = useContext(PollScopeNavContext);
  if (!ctx) {
    throw new Error('usePollScopeNav must be used within PollScopeNavProvider');
  }
  return ctx;
}
