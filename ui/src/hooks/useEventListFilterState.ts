import { useState, useMemo, useEffect } from 'react';
import {
  getDefaultEventFilterDateTexts,
  type EventDateMode,
  type EventListFilterState,
} from '../utils/eventListFilters';
import { loadEventListFilterPrefs, saveEventListFilterPrefs } from '../utils/eventsScreenPrefs';

export function useEventListFilterState() {
  const { defaultStartSpecificText, defaultEndSpecificText } = useMemo(
    () => getDefaultEventFilterDateTexts(),
    []
  );

  const [filterRsvp, setFilterRsvp] = useState<string[]>([]);
  const [filterNeeds, setFilterNeeds] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [startDateText, setStartDateText] = useState(defaultStartSpecificText);
  const [endDateText, setEndDateText] = useState(defaultEndSpecificText);
  const [startMode, setStartMode] = useState<EventDateMode>('now');
  const [endMode, setEndMode] = useState<EventDateMode>('allTime');
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const partial = await loadEventListFilterPrefs();
      if (cancelled) return;
      if (partial.filterRsvp !== undefined) setFilterRsvp(partial.filterRsvp);
      if (partial.filterNeeds !== undefined) setFilterNeeds(partial.filterNeeds);
      if (partial.showAdvancedFilters !== undefined) {
        setShowAdvancedFilters(partial.showAdvancedFilters);
      }
      if (partial.startDateText) setStartDateText(partial.startDateText);
      if (partial.endDateText) setEndDateText(partial.endDateText);
      if (partial.startMode) setStartMode(partial.startMode);
      if (partial.endMode) setEndMode(partial.endMode);
      if (!cancelled) setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    void saveEventListFilterPrefs({
      filterRsvp,
      filterNeeds,
      showAdvancedFilters,
      startDateText,
      endDateText,
      startMode,
      endMode,
    });
  }, [
    prefsReady,
    filterRsvp,
    filterNeeds,
    showAdvancedFilters,
    startDateText,
    endDateText,
    startMode,
    endMode,
  ]);

  const filters: EventListFilterState = useMemo(
    () => ({
      filterRsvp,
      filterNeeds,
      showAdvancedFilters,
      startDateText,
      endDateText,
      startMode,
      endMode,
    }),
    [
      filterRsvp,
      filterNeeds,
      showAdvancedFilters,
      startDateText,
      endDateText,
      startMode,
      endMode,
    ]
  );

  return {
    filters,
    defaultStartSpecificText,
    defaultEndSpecificText,
    filterRsvp,
    setFilterRsvp,
    filterNeeds,
    setFilterNeeds,
    showAdvancedFilters,
    setShowAdvancedFilters,
    startDateText,
    setStartDateText,
    endDateText,
    setEndDateText,
    startMode,
    setStartMode,
    endMode,
    setEndMode,
  };
}
