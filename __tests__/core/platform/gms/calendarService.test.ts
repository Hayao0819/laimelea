import { createGmsCalendarService } from "../../../../src/core/platform/gms/calendarService";
import type { PlatformAuthService } from "../../../../src/core/platform/types";
import {
  AuthExpiredError,
  ScopeDeniedError,
  fetchCalendarList,
  fetchEvents,
  parseEventTimestamp,
} from "../../../../src/core/calendar/googleCalendarApi";

jest.mock("../../../../src/core/calendar/googleCalendarApi", () => ({
  AuthExpiredError: jest.requireActual(
    "../../../../src/core/calendar/googleCalendarApi",
  ).AuthExpiredError,
  ScopeDeniedError: jest.requireActual(
    "../../../../src/core/calendar/googleCalendarApi",
  ).ScopeDeniedError,
  fetchCalendarList: jest.fn(),
  fetchEvents: jest.fn(),
  parseEventTimestamp: jest.fn(),
}));

const mockFetchCalendarList = fetchCalendarList as jest.Mock;
const mockFetchEvents = fetchEvents as jest.Mock;
const mockParseEventTimestamp = parseEventTimestamp as jest.Mock;

function createMockAuthService(
  token: string | null = "test-token",
): PlatformAuthService {
  return {
    isAvailable: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue(token),
  };
}

const sampleCalendars = [
  {
    id: "cal-1",
    summary: "Work",
    backgroundColor: "#0000ff",
    primary: true,
  },
  {
    id: "cal-2",
    summary: "Personal",
    backgroundColor: "#ff0000",
    primary: false,
  },
];

const workEvents = [
  {
    id: "ev-1",
    summary: "Meeting",
    description: "Standup",
    status: "confirmed",
    start: { dateTime: "2026-01-15T10:00:00Z" },
    end: { dateTime: "2026-01-15T11:00:00Z" },
    colorId: "#00ff00",
  },
];

const personalEvents = [
  {
    id: "ev-2",
    summary: "Lunch",
    description: "",
    status: "confirmed",
    start: { dateTime: "2026-01-15T12:00:00Z" },
    end: { dateTime: "2026-01-15T13:00:00Z" },
  },
];

function setupSuccessfulFetch() {
  mockFetchCalendarList.mockResolvedValue(sampleCalendars);
  mockFetchEvents
    .mockResolvedValueOnce(workEvents)
    .mockResolvedValueOnce(personalEvents);
  mockParseEventTimestamp
    .mockReturnValueOnce({
      startMs: 1737021600000,
      endMs: 1737025200000,
      allDay: false,
    })
    .mockReturnValueOnce({
      startMs: 1737028800000,
      endMs: 1737032400000,
      allDay: false,
    });
}

describe("createGmsCalendarService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("should return true when auth token available", async () => {
      const authService = createMockAuthService("valid-token");
      const service = createGmsCalendarService(authService);
      expect(await service.isAvailable()).toBe(true);
    });

    it("should return false when no token", async () => {
      const authService = createMockAuthService(null);
      const service = createGmsCalendarService(authService);
      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe("fetchEvents", () => {
    it("should fetch events from all calendars and map to CalendarEvent", async () => {
      const authService = createMockAuthService("test-token");
      const service = createGmsCalendarService(authService);

      setupSuccessfulFetch();

      const startMs = new Date("2026-01-01").getTime();
      const endMs = new Date("2026-01-31").getTime();
      const events = await service.fetchEvents(startMs, endMs);

      expect(mockFetchCalendarList).toHaveBeenCalledWith("test-token");
      expect(mockFetchEvents).toHaveBeenCalledTimes(2);
      expect(mockFetchEvents).toHaveBeenCalledWith(
        "test-token",
        "cal-1",
        new Date(startMs),
        new Date(endMs),
      );
      expect(mockFetchEvents).toHaveBeenCalledWith(
        "test-token",
        "cal-2",
        new Date(startMs),
        new Date(endMs),
      );

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        id: "google-cal-1-ev-1",
        sourceEventId: "ev-1",
        source: "google",
        title: "Meeting",
        description: "Standup",
        startTimestampMs: 1737021600000,
        endTimestampMs: 1737025200000,
        allDay: false,
        colorId: "#00ff00",
        calendarName: "Work",
        calendarId: "cal-1",
      });
      expect(events[1]).toEqual({
        id: "google-cal-2-ev-2",
        sourceEventId: "ev-2",
        source: "google",
        title: "Lunch",
        description: "",
        startTimestampMs: 1737028800000,
        endTimestampMs: 1737032400000,
        allDay: false,
        colorId: "#ff0000",
        calendarName: "Personal",
        calendarId: "cal-2",
      });
    });

    it("should return empty when no token", async () => {
      const authService = createMockAuthService(null);
      const service = createGmsCalendarService(authService);
      const events = await service.fetchEvents(0, 1000);
      expect(events).toEqual([]);
      expect(mockFetchCalendarList).not.toHaveBeenCalled();
    });

    it("should retry once on AuthExpiredError and succeed", async () => {
      const authService = createMockAuthService("test-token");
      (authService.getAccessToken as jest.Mock)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("refreshed-token");
      const service = createGmsCalendarService(authService);

      mockFetchCalendarList
        .mockRejectedValueOnce(new AuthExpiredError())
        .mockResolvedValueOnce([sampleCalendars[0]]);
      mockFetchEvents.mockResolvedValueOnce(workEvents);
      mockParseEventTimestamp.mockReturnValueOnce({
        startMs: 1737021600000,
        endMs: 1737025200000,
        allDay: false,
      });

      const events = await service.fetchEvents(0, 1000);

      expect(authService.getAccessToken).toHaveBeenCalledTimes(2);
      expect(mockFetchCalendarList).toHaveBeenCalledTimes(2);
      expect(mockFetchCalendarList).toHaveBeenNthCalledWith(1, "expired-token");
      expect(mockFetchCalendarList).toHaveBeenNthCalledWith(
        2,
        "refreshed-token",
      );
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Meeting");
    });

    it("should throw AuthExpiredError when retry also fails", async () => {
      const authService = createMockAuthService("test-token");
      (authService.getAccessToken as jest.Mock)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("still-expired-token");
      const service = createGmsCalendarService(authService);

      mockFetchCalendarList
        .mockRejectedValueOnce(new AuthExpiredError())
        .mockRejectedValueOnce(new AuthExpiredError());

      await expect(service.fetchEvents(0, 1000)).rejects.toThrow(
        AuthExpiredError,
      );
    });

    it("should throw AuthExpiredError when refreshed token is null", async () => {
      const authService = createMockAuthService("test-token");
      (authService.getAccessToken as jest.Mock)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce(null);
      const service = createGmsCalendarService(authService);

      mockFetchCalendarList.mockRejectedValueOnce(new AuthExpiredError());

      await expect(service.fetchEvents(0, 1000)).rejects.toThrow(
        AuthExpiredError,
      );
    });

    it("should throw ScopeDeniedError without retry", async () => {
      const authService = createMockAuthService("test-token");
      const service = createGmsCalendarService(authService);
      mockFetchCalendarList.mockRejectedValue(new ScopeDeniedError());

      await expect(service.fetchEvents(0, 1000)).rejects.toThrow(
        ScopeDeniedError,
      );
      expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("should throw network errors without retry", async () => {
      const authService = createMockAuthService("test-token");
      const service = createGmsCalendarService(authService);
      mockFetchCalendarList.mockRejectedValue(new Error("Network error"));

      await expect(service.fetchEvents(0, 1000)).rejects.toThrow(
        "Network error",
      );
      expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCalendarList", () => {
    it("should map Google calendars to CalendarInfo", async () => {
      const authService = createMockAuthService("test-token");
      const service = createGmsCalendarService(authService);

      mockFetchCalendarList.mockResolvedValue([
        {
          id: "cal-1",
          summary: "Work",
          backgroundColor: "#0000ff",
          primary: true,
        },
        {
          id: "cal-2",
          summary: "Personal",
          backgroundColor: "#ff0000",
        },
      ]);

      const list = await service.getCalendarList();
      expect(list).toEqual([
        { id: "cal-1", name: "Work", color: "#0000ff", isPrimary: true },
        { id: "cal-2", name: "Personal", color: "#ff0000", isPrimary: false },
      ]);
    });

    it("should return empty when no token", async () => {
      const authService = createMockAuthService(null);
      const service = createGmsCalendarService(authService);
      const list = await service.getCalendarList();
      expect(list).toEqual([]);
      expect(mockFetchCalendarList).not.toHaveBeenCalled();
    });

    it("should retry once on AuthExpiredError and succeed", async () => {
      const authService = createMockAuthService("test-token");
      (authService.getAccessToken as jest.Mock)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("refreshed-token");
      const service = createGmsCalendarService(authService);

      mockFetchCalendarList
        .mockRejectedValueOnce(new AuthExpiredError())
        .mockResolvedValueOnce([
          {
            id: "cal-1",
            summary: "Work",
            backgroundColor: "#0000ff",
            primary: true,
          },
        ]);

      const list = await service.getCalendarList();

      expect(authService.getAccessToken).toHaveBeenCalledTimes(2);
      expect(mockFetchCalendarList).toHaveBeenCalledTimes(2);
      expect(mockFetchCalendarList).toHaveBeenNthCalledWith(1, "expired-token");
      expect(mockFetchCalendarList).toHaveBeenNthCalledWith(
        2,
        "refreshed-token",
      );
      expect(list).toEqual([
        { id: "cal-1", name: "Work", color: "#0000ff", isPrimary: true },
      ]);
    });

    it("should throw AuthExpiredError when retry also fails", async () => {
      const authService = createMockAuthService("test-token");
      (authService.getAccessToken as jest.Mock)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("still-expired-token");
      const service = createGmsCalendarService(authService);

      mockFetchCalendarList
        .mockRejectedValueOnce(new AuthExpiredError())
        .mockRejectedValueOnce(new AuthExpiredError());

      await expect(service.getCalendarList()).rejects.toThrow(AuthExpiredError);
    });

    it("should throw ScopeDeniedError without retry", async () => {
      const authService = createMockAuthService("test-token");
      const service = createGmsCalendarService(authService);
      mockFetchCalendarList.mockRejectedValue(new ScopeDeniedError());

      await expect(service.getCalendarList()).rejects.toThrow(ScopeDeniedError);
      expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("should throw network errors without retry", async () => {
      const authService = createMockAuthService("test-token");
      const service = createGmsCalendarService(authService);
      mockFetchCalendarList.mockRejectedValue(new Error("Network error"));

      await expect(service.getCalendarList()).rejects.toThrow("Network error");
      expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
    });
  });
});
