import { atom } from "jotai";
import type { CalendarEvent } from "../models/CalendarEvent";

export const calendarEventsAtom = atom<CalendarEvent[]>([]);
export const calendarLoadingAtom = atom<boolean>(false);
export const calendarLastSyncAtom = atom<number | null>(null);
