import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  calendarEventsAtom,
  calendarLoadingAtom,
  calendarLastSyncAtom,
  calendarSyncErrorAtom,
  calendarCacheStaleAtom,
} from "../atoms/calendarAtoms";
import { platformServicesAtom } from "../atoms/platformAtoms";
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
  const isStale = useAtomValue(calendarCacheStaleAtom);
  const services = useAtomValue(platformServicesAtom);

  const syncingRef = useRef(false);

  const sync = useCallback(
    async (force = false) => {
      if (syncingRef.current) return;
      if (!force && !isStale) return;

      syncingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const result = await syncCalendarEvents(services.calendar);
        setEvents(result.events);
        setLastSync(result.syncTimestamp);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
        syncingRef.current = false;
      }
    },
    [isStale, services.calendar, setEvents, setLastSync, setLoading, setError],
  );

  return { events, loading, error, isStale, sync };
}
