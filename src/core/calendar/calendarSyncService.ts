import type { CalendarEvent } from "../../models/CalendarEvent";
import type { PlatformCalendarService } from "../platform/types";

const SYNC_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function syncCalendarEvents(
  calendarService: PlatformCalendarService,
): Promise<{ events: CalendarEvent[]; syncTimestamp: number }> {
  const now = Date.now();
  const startMs = now - SYNC_WINDOW_DAYS * MS_PER_DAY;
  const endMs = now + SYNC_WINDOW_DAYS * MS_PER_DAY;

  const events = await calendarService.fetchEvents(startMs, endMs);

  return {
    events,
    syncTimestamp: Date.now(),
  };
}
