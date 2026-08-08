import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type EventScopeNavContextValue = {
  optimisticAllEvents: boolean;
  setOptimisticAllEvents: (value: boolean) => void;
  viewMode: 'list' | 'calendar';
  setViewMode: (mode: 'list' | 'calendar') => void;
  fromEventId: string | undefined;
  setFromEventId: (id: string | undefined) => void;
};

const EventScopeNavContext = createContext<EventScopeNavContextValue | null>(null);

export function EventScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticAllEvents, setOptimisticAllEvents] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [fromEventId, setFromEventId] = useState<string | undefined>(undefined);

  const value = useMemo(
    () => ({
      optimisticAllEvents,
      setOptimisticAllEvents,
      viewMode,
      setViewMode,
      fromEventId,
      setFromEventId,
    }),
    [optimisticAllEvents, viewMode, fromEventId]
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
