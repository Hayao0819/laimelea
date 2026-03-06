import { PermissionsAndroid } from "react-native";

import type { CalendarEvent } from "../../../models/CalendarEvent";
import { getNativeCalendarModule } from "../native/calendarModule";
import type { CalendarInfo, PlatformCalendarService } from "../types";

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

      try {
        const instances = await mod.getEventInstances(startMs, endMs);
        return instances.map(
          (e): CalendarEvent => ({
            id: e.id,
            sourceEventId: e.id,
            source: "local",
            title: e.title,
            description: e.description,
            startTimestampMs: e.startMs,
            endTimestampMs: e.endMs,
            allDay: e.allDay,
            colorId: e.color,
            calendarName: e.calendarName,
            calendarId: e.calendarId,
          }),
        );
      } catch {
        return [];
      }
    },

    async getCalendarList() {
      const mod = getNativeCalendarModule();
      if (mod == null) return [];

      try {
        const calendars = await mod.getCalendars();
        return calendars.map(
          (c): CalendarInfo => ({
            id: c.id,
            name: c.name,
            color: c.color,
            isPrimary: c.isPrimary,
          }),
        );
      } catch {
        return [];
      }
    },
  };
}
