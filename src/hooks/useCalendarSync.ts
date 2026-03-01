import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  calendarEventsAtom,
  calendarLoadingAtom,
  calendarLastSyncAtom,
  calendarSyncErrorAtom,
  calendarCacheStaleAtom,
  calendarListAtom,
} from "../atoms/calendarAtoms";
import { platformServicesAtom } from "../atoms/platformAtoms";
import { accountsAtom, resolvedSettingsAtom } from "../atoms/settingsAtoms";
import {
  syncCalendarEvents,
  syncMultiAccountCalendarEvents,
} from "../core/calendar/calendarSyncService";
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
  const accounts = useAtomValue(accountsAtom);

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

        if (accounts.length > 0) {
          // Multi-account sync via AccountManager
          const result = await syncMultiAccountCalendarEvents(
            services.accountManager,
            visibleIds,
          );
          setEvents(result.events);
          setLastSync(result.syncTimestamp);

          if (result.errors.length > 0 && result.events.length === 0) {
            setError(result.errors.map((e) => e.error).join("; "));
          }
        } else if (settings.accountEmail) {
          // Legacy single-account sync via PlatformCalendarService
          const result = await syncCalendarEvents(
            services.calendar,
            visibleIds,
          );
          setEvents(result.events);
          setLastSync(result.syncTimestamp);
        } else {
          // No accounts configured - return empty
          setEvents([]);
          setLastSync(Date.now());
        }

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
      accounts,
      services.accountManager,
      services.calendar,
      settings.visibleCalendarIds,
      settings.accountEmail,
      setEvents,
      setLastSync,
      setCalendarList,
      setLoading,
      setError,
    ],
  );

  return { events, loading, error, isStale, sync };
}
