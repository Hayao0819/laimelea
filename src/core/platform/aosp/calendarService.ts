import { PermissionsAndroid } from "react-native";

import type { CalendarEvent } from "../../../models/CalendarEvent";
import { getNativeCalendarModule } from "../native/calendarModule";
import type { CalendarInfo, PlatformCalendarService } from "../types";

// CalendarContract stores all-day BEGIN/END as UTC midnight, not local
// midnight; reinterpret the UTC calendar date as a local-midnight timestamp
// so local-day bucketing (intersectsLocalDay) doesn't span two days.
function normalizeAllDayBoundary(utcMs: number): number {
  const date = new Date(utcMs);
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ).getTime();
}

export function createAospCalendarService(): PlatformCalendarService {
  return {
    async isAvailable() {
      return getNativeCalendarModule() != null;
    },

    async requestPermissions() {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
      );
      if (granted) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    },

    async fetchEvents(startMs: number, endMs: number) {
      const mod = getNativeCalendarModule();
      if (mod == null) return [];

      const instances = await mod.getEventInstances(startMs, endMs);
      return instances.map(
        (e): CalendarEvent => ({
          id: e.id,
          sourceEventId: e.sourceEventId,
          source: "local",
          title: e.title,
          description: e.description,
          startTimestampMs: e.allDay
            ? normalizeAllDayBoundary(e.startMs)
            : e.startMs,
          endTimestampMs: e.allDay ? normalizeAllDayBoundary(e.endMs) : e.endMs,
          allDay: e.allDay,
          colorId: e.color,
          calendarName: e.calendarName,
          calendarId: e.calendarId,
        }),
      );
    },

    async getCalendarList() {
      const mod = getNativeCalendarModule();
      if (mod == null) return [];

      const calendars = await mod.getCalendars();
      return calendars.map(
        (c): CalendarInfo => ({
          id: c.id,
          name: c.name,
          color: c.color,
          isPrimary: c.isPrimary,
        }),
      );
    },
  };
}
