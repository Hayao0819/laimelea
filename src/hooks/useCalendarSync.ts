import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";

import {
  calendarCacheStaleAtom,
  calendarEventsAtom,
  calendarLastSyncAtom,
  calendarListAtom,
  calendarLoadingAtom,
  calendarSyncErrorAtom,
} from "../atoms/calendarAtoms";
import { platformServicesAtom } from "../atoms/platformAtoms";
import { resolvedSettingsAtom } from "../atoms/settingsAtoms";
import { syncCalendarEvents } from "../core/calendar/calendarSyncService";
import type { CalendarEvent } from "../models/CalendarEvent";

export interface CalendarSyncResult {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  isStale: boolean;
  sync: (force?: boolean) => Promise<void>;
}

export function useCalendarSync(): CalendarSyncResult {
  const [events, setEvents] = useAtom(calendarEventsAtom);
  const [loading, setLoading] = useAtom(calendarLoadingAtom);
  const [error, setError] = useAtom(calendarSyncErrorAtom);
  const setLastSync = useSetAtom(calendarLastSyncAtom);
  const setCalendarList = useSetAtom(calendarListAtom);
  const isStale = useAtomValue(calendarCacheStaleAtom);
  const services = useAtomValue(platformServicesAtom);
  const settings = useAtomValue(resolvedSettingsAtom);

  const syncingRef = useRef(false);

  const sync = useCallback(
    async (force = false) => {
      if (syncingRef.current) return;
      if (!force && !isStale) return;

      syncingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const visibleIds =
          settings.visibleCalendarIds.length > 0
            ? settings.visibleCalendarIds
            : undefined;

        const result = await syncCalendarEvents(services.calendar, visibleIds);
        setEvents(result.events);
        setLastSync(result.syncTimestamp);

        try {
          const calendars = await services.calendar.getCalendarList();
          setCalendarList(calendars);
        } catch {
          // ignore - calendar list is supplementary
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
        syncingRef.current = false;
      }
    },
    [
      isStale,
      services.calendar,
      settings.visibleCalendarIds,
      setEvents,
      setLastSync,
      setCalendarList,
      setLoading,
      setError,
    ],
  );

  return { events, loading, error, isStale, sync };
}
