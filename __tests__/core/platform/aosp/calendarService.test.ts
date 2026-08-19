import { PermissionsAndroid } from "react-native";

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
      getEventInstances: (...args: unknown[]) => mockGetEventInstances(...args),
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

  describe("requestPermissions", () => {
    it("short-circuits without requesting when already granted", async () => {
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValue(true);
      const requestSpy = jest.spyOn(PermissionsAndroid, "request");

      const service = createAospCalendarService();
      const granted = await service.requestPermissions();

      expect(granted).toBe(true);
      expect(PermissionsAndroid.check).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
      );
      expect(requestSpy).not.toHaveBeenCalled();
    });

    it("requests the permission and returns true when the user grants it", async () => {
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValue(false);
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const service = createAospCalendarService();
      const granted = await service.requestPermissions();

      expect(granted).toBe(true);
      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
      );
    });

    it("requests the permission and returns false when the user denies it", async () => {
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValue(false);
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      const service = createAospCalendarService();
      const granted = await service.requestPermissions();

      expect(granted).toBe(false);
    });
  });

  describe("fetchEvents", () => {
    it("should map native event instances to CalendarEvent model", async () => {
      mockGetEventInstances.mockResolvedValue([
        {
          id: "42:1700000000000",
          sourceEventId: "42",
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
          id: "43:1700010000000",
          sourceEventId: "43",
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
        id: "42:1700000000000",
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
        id: "43:1700010000000",
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

    it("should propagate getEventInstances errors", async () => {
      mockGetEventInstances.mockRejectedValue(
        new Error("ContentProvider error"),
      );
      const service = createAospCalendarService();
      await expect(service.fetchEvents(0, 1000)).rejects.toThrow(
        "ContentProvider error",
      );
    });

    describe("all-day event normalization", () => {
      const originalTimezone = process.env.TZ;

      afterEach(() => {
        if (originalTimezone === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTimezone;
        }
      });

      it("normalizes UTC-midnight boundaries to local midnight in UTC+9", async () => {
        process.env.TZ = "Asia/Tokyo";
        mockGetEventInstances.mockResolvedValue([
          {
            id: "10:1705276800000",
            sourceEventId: "10",
            calendarId: "1",
            calendarName: "Holidays",
            title: "Trip",
            description: "",
            startMs: Date.UTC(2024, 0, 15),
            endMs: Date.UTC(2024, 0, 16),
            allDay: true,
            color: null,
          },
        ]);

        const service = createAospCalendarService();
        const [event] = await service.fetchEvents(0, 1);

        expect(event.startTimestampMs).toBe(new Date(2024, 0, 15).getTime());
        expect(event.endTimestampMs).toBe(new Date(2024, 0, 16).getTime());
      });

      it("normalizes UTC-midnight boundaries to local midnight in UTC-5", async () => {
        process.env.TZ = "America/New_York";
        mockGetEventInstances.mockResolvedValue([
          {
            id: "10:1705276800000",
            sourceEventId: "10",
            calendarId: "1",
            calendarName: "Holidays",
            title: "Trip",
            description: "",
            startMs: Date.UTC(2024, 0, 15),
            endMs: Date.UTC(2024, 0, 16),
            allDay: true,
            color: null,
          },
        ]);

        const service = createAospCalendarService();
        const [event] = await service.fetchEvents(0, 1);

        expect(event.startTimestampMs).toBe(new Date(2024, 0, 15).getTime());
        expect(event.endTimestampMs).toBe(new Date(2024, 0, 16).getTime());
      });

      it("normalizes a multi-day (3-day) all-day event span to local midnight boundaries", async () => {
        process.env.TZ = "Asia/Tokyo";
        mockGetEventInstances.mockResolvedValue([
          {
            id: "12:1705276800000",
            sourceEventId: "12",
            calendarId: "1",
            calendarName: "Holidays",
            title: "Trip",
            description: "",
            startMs: Date.UTC(2024, 0, 15),
            endMs: Date.UTC(2024, 0, 18),
            allDay: true,
            color: null,
          },
        ]);

        const service = createAospCalendarService();
        const [event] = await service.fetchEvents(0, 1);

        expect(event.startTimestampMs).toBe(new Date(2024, 0, 15).getTime());
        expect(event.endTimestampMs).toBe(new Date(2024, 0, 18).getTime());
        expect(event.endTimestampMs - event.startTimestampMs).toBe(
          3 * 24 * 60 * 60 * 1000,
        );
      });

      it("leaves timed (non-all-day) event boundaries untouched", async () => {
        process.env.TZ = "Asia/Tokyo";
        mockGetEventInstances.mockResolvedValue([
          {
            id: "11:1700000000000",
            sourceEventId: "11",
            calendarId: "1",
            calendarName: "Work",
            title: "Meeting",
            description: "",
            startMs: 1700000000000,
            endMs: 1700003600000,
            allDay: false,
            color: null,
          },
        ]);

        const service = createAospCalendarService();
        const [event] = await service.fetchEvents(0, 1);

        expect(event.startTimestampMs).toBe(1700000000000);
        expect(event.endTimestampMs).toBe(1700003600000);
      });
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

    it("should propagate getCalendars errors", async () => {
      mockGetCalendars.mockRejectedValue(new Error("Permission denied"));
      const service = createAospCalendarService();
      await expect(service.getCalendarList()).rejects.toThrow(
        "Permission denied",
      );
    });
  });
});
