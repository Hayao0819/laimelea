import {
  syncCalendarEvents,
  syncMultiAccountCalendarEvents,
} from "../../../src/core/calendar/calendarSyncService";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";
import type { PlatformCalendarService } from "../../../src/core/platform/types";
import type { AccountManager } from "../../../src/core/account/types";
import {
  fetchCalendarList,
  fetchEvents,
} from "../../../src/core/calendar/googleCalendarApi";

jest.mock("../../../src/core/calendar/googleCalendarApi", () => ({
  fetchCalendarList: jest.fn(),
  fetchEvents: jest.fn(),
  parseEventTimestamp: jest.requireActual(
    "../../../src/core/calendar/googleCalendarApi",
  ).parseEventTimestamp,
}));

const mockFetchCalendarList = fetchCalendarList as jest.MockedFunction<
  typeof fetchCalendarList
>;
const mockFetchEvents = fetchEvents as jest.MockedFunction<typeof fetchEvents>;

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
    isAvailable: jest.fn().mockResolvedValue(true),
  };
}

function createMockAccountManager(
  tokens: Map<string, string> = new Map(),
): AccountManager {
  return {
    getAccounts: jest.fn().mockResolvedValue([]),
    addAccount: jest.fn().mockRejectedValue(new Error("not implemented")),
    removeAccount: jest.fn().mockResolvedValue(undefined),
    getAccessToken: jest.fn().mockResolvedValue(null),
    getAllAccessTokens: jest.fn().mockResolvedValue(tokens),
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SYNC_WINDOW_DAYS = 14;

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

describe("syncMultiAccountCalendarEvents", () => {
  function setupGoogleApiMocks(
    calendarsPerToken: Record<
      string,
      Array<{ id: string; summary: string; backgroundColor: string | null }>
    >,
    eventsPerCalendar: Record<
      string,
      Array<{
        id: string;
        summary: string;
        description: string;
        status: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        colorId?: string;
      }>
    >,
  ) {
    mockFetchCalendarList.mockImplementation(async (accessToken: string) => {
      const cals = calendarsPerToken[accessToken];
      if (!cals) throw new Error("Unknown token");
      return cals.map((c) => ({ ...c, primary: false }));
    });

    mockFetchEvents.mockImplementation(
      async (_token: string, calendarId: string) => {
        return eventsPerCalendar[calendarId] ?? [];
      },
    );
  }

  it("should fetch events from a single account", async () => {
    const tokens = new Map([["user@example.com", "token-a"]]);
    const manager = createMockAccountManager(tokens);

    setupGoogleApiMocks(
      {
        "token-a": [
          { id: "cal-1", summary: "Work", backgroundColor: "#0000ff" },
        ],
      },
      {
        "cal-1": [
          {
            id: "ev1",
            summary: "Meeting",
            description: "desc",
            status: "confirmed",
            start: { dateTime: "2026-03-01T10:00:00Z" },
            end: { dateTime: "2026-03-01T11:00:00Z" },
          },
        ],
      },
    );

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Meeting");
    expect(result.events[0].sourceEventId).toBe("ev1");
    expect(result.events[0].calendarId).toBe("cal-1");
    expect(result.errors).toHaveLength(0);
  });

  it("should merge events from two accounts", async () => {
    const tokens = new Map([
      ["alice@example.com", "token-alice"],
      ["bob@example.com", "token-bob"],
    ]);
    const manager = createMockAccountManager(tokens);

    setupGoogleApiMocks(
      {
        "token-alice": [
          { id: "cal-a", summary: "Alice Cal", backgroundColor: null },
        ],
        "token-bob": [
          { id: "cal-b", summary: "Bob Cal", backgroundColor: null },
        ],
      },
      {
        "cal-a": [
          {
            id: "ev-alice",
            summary: "Alice Meeting",
            description: "",
            status: "confirmed",
            start: { dateTime: "2026-03-01T09:00:00Z" },
            end: { dateTime: "2026-03-01T10:00:00Z" },
          },
        ],
        "cal-b": [
          {
            id: "ev-bob",
            summary: "Bob Meeting",
            description: "",
            status: "confirmed",
            start: { dateTime: "2026-03-01T14:00:00Z" },
            end: { dateTime: "2026-03-01T15:00:00Z" },
          },
        ],
      },
    );

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.events).toHaveLength(2);
    const titles = result.events.map((e) => e.title).sort();
    expect(titles).toEqual(["Alice Meeting", "Bob Meeting"]);
    expect(result.errors).toHaveLength(0);
  });

  it("should filter by visibleCalendarIds", async () => {
    const tokens = new Map([["user@example.com", "token-a"]]);
    const manager = createMockAccountManager(tokens);

    setupGoogleApiMocks(
      {
        "token-a": [
          { id: "cal-1", summary: "Work", backgroundColor: null },
          { id: "cal-2", summary: "Personal", backgroundColor: null },
        ],
      },
      {
        "cal-1": [
          {
            id: "ev1",
            summary: "Work Meeting",
            description: "",
            status: "confirmed",
            start: { dateTime: "2026-03-01T10:00:00Z" },
            end: { dateTime: "2026-03-01T11:00:00Z" },
          },
        ],
        "cal-2": [
          {
            id: "ev2",
            summary: "Personal Task",
            description: "",
            status: "confirmed",
            start: { dateTime: "2026-03-01T12:00:00Z" },
            end: { dateTime: "2026-03-01T13:00:00Z" },
          },
        ],
      },
    );

    const result = await syncMultiAccountCalendarEvents(manager, ["cal-1"]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Work Meeting");
  });

  it("should continue when one account fails and another succeeds", async () => {
    const tokens = new Map([
      ["good@example.com", "token-good"],
      ["bad@example.com", "token-bad"],
    ]);
    const manager = createMockAccountManager(tokens);

    mockFetchCalendarList.mockImplementation(async (accessToken: string) => {
      if (accessToken === "token-bad") {
        throw new Error("Token expired");
      }
      return [
        {
          id: "cal-g",
          summary: "Good Cal",
          backgroundColor: null,
          primary: false,
        },
      ];
    });

    mockFetchEvents.mockImplementation(async () => [
      {
        id: "ev-good",
        summary: "Good Event",
        description: "",
        status: "confirmed",
        start: { dateTime: "2026-03-01T10:00:00Z" },
        end: { dateTime: "2026-03-01T11:00:00Z" },
      },
    ]);

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Good Event");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].email).toBe("bad@example.com");
    expect(result.errors[0].error).toBe("Token expired");
  });

  it("should return empty events and errors when all accounts fail", async () => {
    const tokens = new Map([
      ["a@example.com", "token-a"],
      ["b@example.com", "token-b"],
    ]);
    const manager = createMockAccountManager(tokens);

    mockFetchCalendarList.mockRejectedValue(new Error("API down"));

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.email).sort()).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("should deduplicate events shared across accounts by sourceEventId", async () => {
    const tokens = new Map([
      ["alice@example.com", "token-alice"],
      ["bob@example.com", "token-bob"],
    ]);
    const manager = createMockAccountManager(tokens);

    const sharedEvent = {
      id: "shared-ev",
      summary: "Shared Meeting",
      description: "",
      status: "confirmed",
      start: { dateTime: "2026-03-01T10:00:00Z" },
      end: { dateTime: "2026-03-01T11:00:00Z" },
    };

    setupGoogleApiMocks(
      {
        "token-alice": [
          { id: "cal-a", summary: "Alice Cal", backgroundColor: null },
        ],
        "token-bob": [
          { id: "cal-b", summary: "Bob Cal", backgroundColor: null },
        ],
      },
      {
        "cal-a": [sharedEvent],
        "cal-b": [sharedEvent],
      },
    );

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].sourceEventId).toBe("shared-ev");
  });

  it("should return empty events with no errors when no accounts have tokens", async () => {
    const manager = createMockAccountManager(new Map());

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(typeof result.syncTimestamp).toBe("number");
  });

  it("should return syncTimestamp", async () => {
    const manager = createMockAccountManager(new Map());
    const before = Date.now();

    const result = await syncMultiAccountCalendarEvents(manager);

    expect(result.syncTimestamp).toBeGreaterThanOrEqual(before);
  });
});
