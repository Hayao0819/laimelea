import { syncCalendarEvents } from "../../../src/core/calendar/calendarSyncService";
import type { PlatformCalendarService } from "../../../src/core/platform/types";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SYNC_WINDOW_DAYS = 14;

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    sourceEventId: "source-evt-1",
    source: "google",
    title: "Team Meeting",
    description: "",
    startTimestampMs: 1700000000000,
    endTimestampMs: 1700003600000,
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

function createMockCalendarService(
  events: CalendarEvent[] = [],
): PlatformCalendarService {
  return {
    fetchEvents: jest.fn().mockResolvedValue(events),
    getCalendarList: jest.fn().mockResolvedValue([]),
    requestPermissions: jest.fn().mockResolvedValue(true),
    isAvailable: jest.fn().mockResolvedValue(true),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("syncCalendarEvents", () => {
  it("should call fetchEvents with +/-14 day range", async () => {
    const service = createMockCalendarService();
    const now = Date.now();

    await syncCalendarEvents(service);

    expect(service.fetchEvents).toHaveBeenCalledWith(
      now - SYNC_WINDOW_DAYS * MS_PER_DAY,
      now + SYNC_WINDOW_DAYS * MS_PER_DAY,
    );
  });

  it("should return fetched events as-is", async () => {
    const events = [
      makeEvent({ id: "evt-1", title: "Meeting 1" }),
      makeEvent({ id: "evt-2", title: "Meeting 2" }),
    ];
    const service = createMockCalendarService(events);

    const result = await syncCalendarEvents(service);

    expect(result.events).toEqual(events);
    expect(result.events).toHaveLength(2);
  });

  it("should return syncTimestamp", async () => {
    const service = createMockCalendarService();
    const before = Date.now();

    const result = await syncCalendarEvents(service);

    expect(result.syncTimestamp).toBeGreaterThanOrEqual(before);
    expect(typeof result.syncTimestamp).toBe("number");
  });

  it("should return all events when visibleCalendarIds is undefined", async () => {
    const events = [
      makeEvent({ id: "evt-1", calendarId: "cal-1" }),
      makeEvent({ id: "evt-2", calendarId: "cal-2" }),
      makeEvent({ id: "evt-3", calendarId: "cal-3" }),
    ];
    const service = createMockCalendarService(events);

    const result = await syncCalendarEvents(service);

    expect(result.events).toHaveLength(3);
  });

  it("should filter events by visibleCalendarIds when specified", async () => {
    const events = [
      makeEvent({ id: "evt-1", calendarId: "cal-1" }),
      makeEvent({ id: "evt-2", calendarId: "cal-2" }),
      makeEvent({ id: "evt-3", calendarId: "cal-3" }),
    ];
    const service = createMockCalendarService(events);

    const result = await syncCalendarEvents(service, ["cal-1", "cal-3"]);

    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e.calendarId)).toEqual(["cal-1", "cal-3"]);
  });

  it("should return all events when visibleCalendarIds is empty array", async () => {
    const events = [
      makeEvent({ id: "evt-1", calendarId: "cal-1" }),
      makeEvent({ id: "evt-2", calendarId: "cal-2" }),
    ];
    const service = createMockCalendarService(events);

    const result = await syncCalendarEvents(service, []);

    expect(result.events).toHaveLength(2);
  });
});
