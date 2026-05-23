import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type EventScopeNavContextValue = {
  optimisticAllEvents: boolean;
  setOptimisticAllEvents: (value: boolean) => void;
  viewMode: 'list' | 'calendar';
  setViewMode: (mode: 'list' | 'calendar') => void;
};

const EventScopeNavContext = createContext<EventScopeNavContextValue | null>(null);

export function EventScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticAllEvents, setOptimisticAllEvents] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const value = useMemo(
    () => ({
      optimisticAllEvents,
      setOptimisticAllEvents,
      viewMode,
      setViewMode,
    }),
    [optimisticAllEvents, viewMode]
  );

  return <EventScopeNavContext.Provider value={value}>{children}</EventScopeNavContext.Provider>;
}

export function useEventScopeNav() {
  const ctx = useContext(EventScopeNavContext);
  if (!ctx) {
    throw new Error('useEventScopeNav must be used within EventScopeNavProvider');
  }
  return ctx;
}
