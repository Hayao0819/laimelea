import type { CalendarEvent } from "../../models/CalendarEvent";
import type { AccountManager } from "../account/types";
import type { PlatformCalendarService } from "../platform/types";
import {
  fetchCalendarList,
  fetchEvents,
  parseEventTimestamp,
} from "./googleCalendarApi";

const SYNC_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function syncCalendarEvents(
  calendarService: PlatformCalendarService,
  visibleCalendarIds?: string[],
): Promise<{ events: CalendarEvent[]; syncTimestamp: number }> {
  const now = Date.now();
  const startMs = now - SYNC_WINDOW_DAYS * MS_PER_DAY;
  const endMs = now + SYNC_WINDOW_DAYS * MS_PER_DAY;

  let events = await calendarService.fetchEvents(startMs, endMs);

  if (visibleCalendarIds && visibleCalendarIds.length > 0) {
    events = events.filter((e) => visibleCalendarIds.includes(e.calendarId));
  }

  return {
    events,
    syncTimestamp: Date.now(),
  };
}

async function fetchEventsForToken(
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

function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.sourceEventId)) {
      return false;
    }
    seen.add(event.sourceEventId);
    return true;
  });
}

export interface MultiAccountSyncResult {
  events: CalendarEvent[];
  syncTimestamp: number;
  errors: Array<{ email: string; error: string }>;
}

export async function syncMultiAccountCalendarEvents(
  accountManager: AccountManager,
  visibleCalendarIds?: string[],
): Promise<MultiAccountSyncResult> {
  const now = Date.now();
  const startMs = now - SYNC_WINDOW_DAYS * MS_PER_DAY;
  const endMs = now + SYNC_WINDOW_DAYS * MS_PER_DAY;

  const tokens = await accountManager.getAllAccessTokens();
  const allEvents: CalendarEvent[] = [];
  const errors: Array<{ email: string; error: string }> = [];

  for (const [email, accessToken] of tokens) {
    try {
      const events = await fetchEventsForToken(accessToken, startMs, endMs);
      allEvents.push(...events);
    } catch (e) {
      errors.push({
        email,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  let events = deduplicateEvents(allEvents);

  if (visibleCalendarIds && visibleCalendarIds.length > 0) {
    events = events.filter((e) => visibleCalendarIds.includes(e.calendarId));
  }

  return {
    events,
    syncTimestamp: Date.now(),
    errors,
  };
}
