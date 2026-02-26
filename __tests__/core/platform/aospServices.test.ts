import { createAospAuthService } from "../../../src/core/platform/aosp/authService";
import { createAospCalendarService } from "../../../src/core/platform/aosp/calendarService";
import { createAospBackupService } from "../../../src/core/platform/aosp/backupService";
import { createAospSleepService } from "../../../src/core/platform/aosp/sleepService";

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

describe("AOSP AuthService", () => {
  const auth = createAospAuthService();

  it("isAvailable should return false", async () => {
    expect(await auth.isAvailable()).toBe(false);
  });

  it("signIn should throw", async () => {
    await expect(auth.signIn()).rejects.toThrow();
  });

  it("signOut should throw", async () => {
    await expect(auth.signOut()).rejects.toThrow();
  });

  it("getAccessToken should return null", async () => {
    expect(await auth.getAccessToken()).toBeNull();
  });
});

describe("AOSP CalendarService", () => {
  const calendar = createAospCalendarService();

  it("isAvailable should return false", async () => {
    expect(await calendar.isAvailable()).toBe(false);
  });

  it("fetchEvents should return empty array", async () => {
    expect(await calendar.fetchEvents(0, 1000)).toEqual([]);
  });

  it("getCalendarList should return empty array", async () => {
    expect(await calendar.getCalendarList()).toEqual([]);
  });
});

describe("AOSP BackupService", () => {
  const backup = createAospBackupService();

  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
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

  it("isAvailable should return false", async () => {
    expect(await sleep.isAvailable()).toBe(false);
  });

  it("fetchSleepSessions should return empty array", async () => {
    expect(await sleep.fetchSleepSessions(0, 1000)).toEqual([]);
  });
});
