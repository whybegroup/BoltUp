import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ChromeHeaderSlotSetters, ChromeHeaderSlotState, ChromeHeaderTheme } from '../chromeHeaderTypes';

type EventScopeNavContextValue = {
  optimisticAllEvents: boolean;
  setOptimisticAllEvents: (value: boolean) => void;
  viewMode: 'list' | 'calendar';
  setViewMode: (mode: 'list' | 'calendar') => void;
  fromEventId: string | undefined;
  setFromEventId: (id: string | undefined) => void;
} & ChromeHeaderSlotSetters;

const EventScopeNavContext = createContext<EventScopeNavContextValue | null>(null);
const EventScopeHeaderSlotContext = createContext<ChromeHeaderSlotState>({
  headerTrailing: null,
  headerTheme: null,
});

export function EventScopeNavProvider({ children }: { children: ReactNode }) {
  const [optimisticAllEvents, setOptimisticAllEvents] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [fromEventId, setFromEventId] = useState<string | undefined>(undefined);
  const [headerTrailing, setHeaderTrailing] = useState<ReactNode | null>(null);
  const [headerTheme, setHeaderTheme] = useState<ChromeHeaderTheme | null>(null);

  const value = useMemo(
    () => ({
      optimisticAllEvents,
      setOptimisticAllEvents,
      viewMode,
      setViewMode,
      fromEventId,
      setFromEventId,
      setHeaderTrailing,
      setHeaderTheme,
    }),
    [optimisticAllEvents, viewMode, fromEventId]
  );

  const slot = useMemo(
    () => ({ headerTrailing, headerTheme }),
    [headerTrailing, headerTheme]
  );

  return (
    <EventScopeNavContext.Provider value={value}>
      <EventScopeHeaderSlotContext.Provider value={slot}>{children}</EventScopeHeaderSlotContext.Provider>
    </EventScopeNavContext.Provider>
  );
}

export function useEventScopeNavOptional() {
  return useContext(EventScopeNavContext);
}

export function useEventScopeHeaderSlot() {
  return useContext(EventScopeHeaderSlotContext);
}

export function useEventScopeNav() {
  const ctx = useContext(EventScopeNavContext);
  if (!ctx) {
    throw new Error('useEventScopeNav must be used within EventScopeNavProvider');
  }
  return ctx;
}
