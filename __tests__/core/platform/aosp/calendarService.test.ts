import { createAospCalendarService } from "../../../../src/core/platform/aosp/calendarService";
import { getNativeCalendarModule } from "../../../../src/core/platform/native/calendarModule";

const mockGetCalendars = jest.fn();
const mockGetEventInstances = jest.fn();

jest.mock("../../../../src/core/platform/native/calendarModule", () => ({
  getNativeCalendarModule: jest.fn(() => ({
    getCalendars: (...args: unknown[]) => mockGetCalendars(...args),
    getEventInstances: (...args: unknown[]) => mockGetEventInstances(...args),
  })),
}));

describe("createAospCalendarService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getNativeCalendarModule as jest.Mock).mockReturnValue({
      getCalendars: (...args: unknown[]) => mockGetCalendars(...args),
      getEventInstances: (...args: unknown[]) =>
        mockGetEventInstances(...args),
    });
  });

  describe("isAvailable", () => {
    it("should return true when native module exists", async () => {
      const service = createAospCalendarService();
      expect(await service.isAvailable()).toBe(true);
    });

    it("should return false when native module is null", async () => {
      (getNativeCalendarModule as jest.Mock).mockReturnValue(null);
      const service = createAospCalendarService();
      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe("fetchEvents", () => {
    it("should map native event instances to CalendarEvent model", async () => {
      mockGetEventInstances.mockResolvedValue([
        {
          id: "42",
          calendarId: "1",
          calendarName: "My Calendar",
          title: "Meeting",
          description: "Team sync",
          startMs: 1700000000000,
          endMs: 1700003600000,
          allDay: false,
          color: "#FF0000",
        },
        {
          id: "43",
          calendarId: "2",
          calendarName: "Work",
          title: "Lunch",
          description: "",
          startMs: 1700010000000,
          endMs: 1700013600000,
          allDay: false,
          color: null,
        },
      ]);

      const service = createAospCalendarService();
      const events = await service.fetchEvents(1700000000000, 1700100000000);

      expect(mockGetEventInstances).toHaveBeenCalledWith(
        1700000000000,
        1700100000000,
      );
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        id: "42",
        sourceEventId: "42",
        source: "local",
        title: "Meeting",
        description: "Team sync",
        startTimestampMs: 1700000000000,
        endTimestampMs: 1700003600000,
        allDay: false,
        colorId: "#FF0000",
        calendarName: "My Calendar",
        calendarId: "1",
      });
      expect(events[1]).toEqual({
        id: "43",
        sourceEventId: "43",
        source: "local",
        title: "Lunch",
        description: "",
        startTimestampMs: 1700010000000,
        endTimestampMs: 1700013600000,
        allDay: false,
        colorId: null,
        calendarName: "Work",
        calendarId: "2",
      });
    });

    it("should return empty array when module is null", async () => {
      (getNativeCalendarModule as jest.Mock).mockReturnValue(null);
      const service = createAospCalendarService();
      const events = await service.fetchEvents(0, 1000);
      expect(events).toEqual([]);
    });

    it("should return empty array when getEventInstances throws", async () => {
      mockGetEventInstances.mockRejectedValue(
        new Error("ContentProvider error"),
      );
      const service = createAospCalendarService();
      const events = await service.fetchEvents(0, 1000);
      expect(events).toEqual([]);
    });
  });

  describe("getCalendarList", () => {
    it("should map native calendars to CalendarInfo", async () => {
      mockGetCalendars.mockResolvedValue([
        { id: "1", name: "Personal", color: "#0000FF", isPrimary: true },
        { id: "2", name: "Work", color: "#00FF00", isPrimary: false },
      ]);

      const service = createAospCalendarService();
      const list = await service.getCalendarList();

      expect(list).toEqual([
        { id: "1", name: "Personal", color: "#0000FF", isPrimary: true },
        { id: "2", name: "Work", color: "#00FF00", isPrimary: false },
      ]);
    });

    it("should return empty array when module is null", async () => {
      (getNativeCalendarModule as jest.Mock).mockReturnValue(null);
      const service = createAospCalendarService();
      const list = await service.getCalendarList();
      expect(list).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockGetCalendars.mockRejectedValue(new Error("Permission denied"));
      const service = createAospCalendarService();
      const list = await service.getCalendarList();
      expect(list).toEqual([]);
    });
  });
});
