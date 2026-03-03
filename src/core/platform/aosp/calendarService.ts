import type { CalendarEvent } from "../../../models/CalendarEvent";
import { getNativeCalendarModule } from "../native/calendarModule";
import type { CalendarInfo, PlatformCalendarService } from "../types";

export function createAospCalendarService(): PlatformCalendarService {
  return {
    async isAvailable() {
      return getNativeCalendarModule() != null;
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
