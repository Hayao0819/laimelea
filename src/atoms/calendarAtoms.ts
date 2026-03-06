import { atom } from "jotai";
import { atomWithStorage, unwrap } from "jotai/utils";

import type { CalendarInfo } from "../core/platform/types";
import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { CalendarEvent } from "../models/CalendarEvent";
import { resolvedSettingsAtom } from "./settingsAtoms";

export type CalendarViewMode = "month" | "week" | "agenda";
export const calendarViewModeAtom = atomWithStorage<CalendarViewMode>(
  STORAGE_KEYS.CALENDAR_VIEW_MODE,
  "agenda",
  createAsyncStorage<CalendarViewMode>(),
  { getOnInit: true },
);

export const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const calendarEventsAtom = atomWithStorage<CalendarEvent[]>(
  STORAGE_KEYS.CALENDAR_CACHE,
  [],
  createAsyncStorage<CalendarEvent[]>(),
  { getOnInit: true },
);
export const calendarLoadingAtom = atom<boolean>(false);
export const calendarLastSyncAtom = atomWithStorage<number | null>(
  STORAGE_KEYS.CALENDAR_LAST_SYNC,
  null,
  createAsyncStorage<number | null>(),
  { getOnInit: true },
);
export const calendarListAtom = atomWithStorage<CalendarInfo[]>(
  STORAGE_KEYS.CALENDAR_LIST,
  [],
  createAsyncStorage<CalendarInfo[]>(),
  { getOnInit: true },
);
export const calendarSyncErrorAtom = atom<string | null>(null);
export const calendarSelectedDateAtom = atom<number>(
  startOfDay(Date.now()).getTime(),
);

const syncLastSyncAtom = unwrap(calendarLastSyncAtom, (prev) => prev ?? null);
const syncEventsAtom = unwrap(calendarEventsAtom, (prev) => prev ?? []);

export const calendarCacheStaleAtom = atom((get) => {
  const lastSync = get(syncLastSyncAtom);
  if (lastSync == null) return true;
  return Date.now() - lastSync > CALENDAR_CACHE_TTL_MS;
});

export const visibleCalendarEventsAtom = atom<CalendarEvent[]>((get) => {
  const events = get(syncEventsAtom);
  const { visibleCalendarIds } = get(resolvedSettingsAtom);
  if (visibleCalendarIds.length === 0) return events;
  return events.filter((e) => visibleCalendarIds.includes(e.calendarId));
});

function startOfDay(ms: number): Date {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}
