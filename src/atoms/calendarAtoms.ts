import { atom } from "jotai";

import type { CalendarInfo } from "../core/platform/types";
import type { CalendarEvent } from "../models/CalendarEvent";
import { resolvedSettingsAtom } from "./settingsAtoms";

export type CalendarViewMode = "month" | "week" | "agenda";
export const calendarViewModeAtom = atom<CalendarViewMode>("agenda");

export const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const calendarEventsAtom = atom<CalendarEvent[]>([]);
export const calendarLoadingAtom = atom<boolean>(false);
export const calendarLastSyncAtom = atom<number | null>(null);
export const calendarListAtom = atom<CalendarInfo[]>([]);
export const calendarSyncErrorAtom = atom<string | null>(null);
export const calendarSelectedDateAtom = atom<number>(
  startOfDay(Date.now()).getTime(),
);

export const calendarCacheStaleAtom = atom((get) => {
  const lastSync = get(calendarLastSyncAtom);
  if (lastSync == null) return true;
  return Date.now() - lastSync > CALENDAR_CACHE_TTL_MS;
});

export const visibleCalendarEventsAtom = atom<CalendarEvent[]>((get) => {
  const events = get(calendarEventsAtom);
  const { visibleCalendarIds } = get(resolvedSettingsAtom);
  if (visibleCalendarIds.length === 0) return events;
  return events.filter((e) => visibleCalendarIds.includes(e.calendarId));
});

function startOfDay(ms: number): Date {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}
