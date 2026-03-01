import type { CalendarEvent } from "../../../models/CalendarEvent";
import type {
  CalendarInfo,
  PlatformAuthService,
  PlatformCalendarService,
} from "../types";
import {
  AuthExpiredError,
  fetchCalendarList,
  fetchEvents,
  parseEventTimestamp,
} from "../../calendar/googleCalendarApi";

export function createGmsCalendarService(
  authService: PlatformAuthService,
): PlatformCalendarService {
  async function fetchAllEvents(
    accessToken: string,
    startMs: number,
    endMs: number,
  ): Promise<CalendarEvent[]> {
    const calendars = await fetchCalendarList(accessToken);
    const timeMin = new Date(startMs);
    const timeMax = new Date(endMs);

    const allEvents: CalendarEvent[] = [];

    for (const cal of calendars) {
      const events = await fetchEvents(accessToken, cal.id, timeMin, timeMax);
      for (const event of events) {
        const {
          startMs: evStartMs,
          endMs: evEndMs,
          allDay,
        } = parseEventTimestamp(event);

        allEvents.push({
          id: `google-${cal.id}-${event.id}`,
          sourceEventId: event.id,
          source: "google",
          title: event.summary || "",
          description: event.description || "",
          startTimestampMs: evStartMs,
          endTimestampMs: evEndMs,
          allDay,
          colorId: event.colorId ?? cal.backgroundColor,
          calendarName: cal.summary,
          calendarId: cal.id,
        });
      }
    }

    return allEvents;
  }

  async function fetchAllCalendars(
    accessToken: string,
  ): Promise<CalendarInfo[]> {
    const calendars = await fetchCalendarList(accessToken);
    return calendars.map((cal) => ({
      id: cal.id,
      name: cal.summary,
      color: cal.backgroundColor,
      isPrimary: cal.primary ?? false,
    }));
  }

  return {
    async isAvailable() {
      const token = await authService.getAccessToken();
      return token != null;
    },

    async fetchEvents(
      startMs: number,
      endMs: number,
    ): Promise<CalendarEvent[]> {
      const token = await authService.getAccessToken();
      if (token == null) return [];

      try {
        return await fetchAllEvents(token, startMs, endMs);
      } catch (error) {
        if (error instanceof AuthExpiredError) {
          const refreshedToken = await authService.getAccessToken();
          if (refreshedToken == null) throw error;
          return await fetchAllEvents(refreshedToken, startMs, endMs);
        }
        throw error;
      }
    },

    async getCalendarList(): Promise<CalendarInfo[]> {
      const token = await authService.getAccessToken();
      if (token == null) return [];

      try {
        return await fetchAllCalendars(token);
      } catch (error) {
        if (error instanceof AuthExpiredError) {
          const refreshedToken = await authService.getAccessToken();
          if (refreshedToken == null) throw error;
          return await fetchAllCalendars(refreshedToken);
        }
        throw error;
      }
    },
  };
}
