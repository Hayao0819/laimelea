import { createAospBackupService } from "../../../src/core/platform/aosp/backupService";
import { createAospCalendarService } from "../../../src/core/platform/aosp/calendarService";
import { createAospSleepService } from "../../../src/core/platform/aosp/sleepService";
import { STORAGE_KEYS } from "../../../src/core/storage/keys";

const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

const mockGetCalendars = jest.fn();
const mockGetEventInstances = jest.fn();

jest.mock("../../../src/core/platform/native/calendarModule", () => ({
  getNativeCalendarModule: jest.fn(() => ({
    getCalendars: (...args: unknown[]) => mockGetCalendars(...args),
    getEventInstances: (...args: unknown[]) => mockGetEventInstances(...args),
  })),
}));

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

describe("AOSP CalendarService", () => {
  const { getNativeCalendarModule } = jest.requireMock<
    typeof import("../../../src/core/platform/native/calendarModule")
  >("../../../src/core/platform/native/calendarModule");

  beforeEach(() => {
    jest.clearAllMocks();
    (getNativeCalendarModule as jest.Mock).mockReturnValue({
      getCalendars: (...args: unknown[]) => mockGetCalendars(...args),
      getEventInstances: (...args: unknown[]) => mockGetEventInstances(...args),
    });
  });

  it("isAvailable should return true when module exists", async () => {
    const calendar = createAospCalendarService();
    expect(await calendar.isAvailable()).toBe(true);
  });

  it("isAvailable should return false when module is null", async () => {
    (getNativeCalendarModule as jest.Mock).mockReturnValue(null);
    const calendar = createAospCalendarService();
    expect(await calendar.isAvailable()).toBe(false);
  });

  it("fetchEvents should convert native instances to CalendarEvent", async () => {
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
    ]);

    const calendar = createAospCalendarService();
    const events = await calendar.fetchEvents(1700000000000, 1700100000000);

    expect(mockGetEventInstances).toHaveBeenCalledWith(
      1700000000000,
      1700100000000,
    );
    expect(events).toEqual([
      {
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
      },
    ]);
  });

  it("fetchEvents should handle allDay events", async () => {
    mockGetEventInstances.mockResolvedValue([
      {
        id: "99:1700000000000",
        sourceEventId: "99",
        calendarId: "2",
        calendarName: "Holidays",
        title: "National Holiday",
        description: "",
        startMs: 1700000000000,
        endMs: 1700086400000,
        allDay: true,
        color: null,
      },
    ]);

    const calendar = createAospCalendarService();
    const events = await calendar.fetchEvents(1700000000000, 1700100000000);

    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].colorId).toBeNull();
  });

  it("fetchEvents should return empty array when module is null", async () => {
    (getNativeCalendarModule as jest.Mock).mockReturnValue(null);
    const calendar = createAospCalendarService();
    expect(await calendar.fetchEvents(0, 1000)).toEqual([]);
  });

  it("fetchEvents should propagate native errors", async () => {
    mockGetEventInstances.mockRejectedValue(new Error("ContentProvider error"));
    const calendar = createAospCalendarService();
    await expect(calendar.fetchEvents(0, 1000)).rejects.toThrow(
      "ContentProvider error",
    );
  });

  it("getCalendarList should convert native calendars to CalendarInfo", async () => {
    mockGetCalendars.mockResolvedValue([
      { id: "1", name: "Personal", color: "#0000FF", isPrimary: true },
      { id: "2", name: "Work", color: "#00FF00", isPrimary: false },
    ]);

    const calendar = createAospCalendarService();
    const list = await calendar.getCalendarList();

    expect(list).toEqual([
      { id: "1", name: "Personal", color: "#0000FF", isPrimary: true },
      { id: "2", name: "Work", color: "#00FF00", isPrimary: false },
    ]);
  });

  it("getCalendarList should return empty array when module is null", async () => {
    (getNativeCalendarModule as jest.Mock).mockReturnValue(null);
    const calendar = createAospCalendarService();
    expect(await calendar.getCalendarList()).toEqual([]);
  });

  it("getCalendarList should propagate native errors", async () => {
    mockGetCalendars.mockRejectedValue(new Error("ContentProvider error"));
    const calendar = createAospCalendarService();
    await expect(calendar.getCalendarList()).rejects.toThrow(
      "ContentProvider error",
    );
  });
});

describe("AOSP BackupService", () => {
  const backup = createAospBackupService();

  beforeEach(() => {
    clearMockStore();
  });

  it("isAvailable should return true", async () => {
    expect(await backup.isAvailable()).toBe(true);
  });

  it("backup and restore should round-trip data", async () => {
    const data = JSON.stringify({ alarms: [1, 2, 3] });
    await backup.backup(data);
    const restored = await backup.restore();
    expect(restored).toBe(data);
  });

  it("getLastBackupTime should return timestamp after backup", async () => {
    const before = Date.now();
    await backup.backup("test");
    const timestamp = await backup.getLastBackupTime();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });
});

describe("AOSP SleepService", () => {
  const sleep = createAospSleepService();

  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
  });

  it("isAvailable should return true (manual entry always available)", async () => {
    expect(await sleep.isAvailable()).toBe(true);
  });

  it("fetchSleepSessions should return empty array when no data", async () => {
    expect(await sleep.fetchSleepSessions(0, 1000)).toEqual([]);
  });

  it("fetchSleepSessions should return manual sessions within range", async () => {
    const sessions = [
      {
        id: "s1",
        source: "manual",
        startTimestampMs: 500,
        endTimestampMs: 600,
        stages: [],
        durationMs: 100,
        createdAt: 500,
        updatedAt: 500,
      },
      {
        id: "s2",
        source: "manual",
        startTimestampMs: 1500,
        endTimestampMs: 1600,
        stages: [],
        durationMs: 100,
        createdAt: 1500,
        updatedAt: 1500,
      },
      {
        id: "s3",
        source: "health_connect",
        startTimestampMs: 500,
        endTimestampMs: 600,
        stages: [],
        durationMs: 100,
        createdAt: 500,
        updatedAt: 500,
      },
    ];
    mockStore[STORAGE_KEYS.SLEEP_SESSIONS] = JSON.stringify(sessions);

    const result = await sleep.fetchSleepSessions(0, 1000);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("fetchSleepSessions should return empty array on parse error", async () => {
    mockStore[STORAGE_KEYS.SLEEP_SESSIONS] = "invalid-json";
    expect(await sleep.fetchSleepSessions(0, 1000)).toEqual([]);
  });
});
