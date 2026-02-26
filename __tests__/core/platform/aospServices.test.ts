import { createAospAuthService } from "../../../src/core/platform/aosp/authService";
import { createAospCalendarService } from "../../../src/core/platform/aosp/calendarService";
import { createAospBackupService } from "../../../src/core/platform/aosp/backupService";
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

const mockAuthorize = jest.fn();
const mockRefresh = jest.fn();
const mockRevoke = jest.fn();

jest.mock("react-native-app-auth", () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  refresh: (...args: unknown[]) => mockRefresh(...args),
  revoke: (...args: unknown[]) => mockRevoke(...args),
}));

const mockGetCalendars = jest.fn();
const mockGetEventInstances = jest.fn();

jest.mock("../../../src/core/platform/native/calendarModule", () => ({
  getNativeCalendarModule: jest.fn(() => ({
    getCalendars: (...args: unknown[]) => mockGetCalendars(...args),
    getEventInstances: (...args: unknown[]) => mockGetEventInstances(...args),
  })),
}));

function encodeBase64Url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  return btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/[=]+$/, "");
}

function makeIdToken(payload: Record<string, unknown>): string {
  const header = encodeBase64Url({ alg: "RS256", typ: "JWT" });
  const body = encodeBase64Url(payload);
  return `${header}.${body}.fake-signature`;
}

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

describe("AOSP AuthService", () => {
  beforeEach(() => {
    clearMockStore();
    jest.clearAllMocks();
  });

  it("isAvailable should return true", async () => {
    const auth = createAospAuthService();
    expect(await auth.isAvailable()).toBe(true);
  });

  it("signIn should call authorize and return AuthResult", async () => {
    const idToken = makeIdToken({ email: "user@gmail.com", sub: "123" });
    mockAuthorize.mockResolvedValue({
      accessToken: "access-token-123",
      refreshToken: "refresh-token-456",
      idToken,
      accessTokenExpirationDate: "2099-01-01T00:00:00Z",
    });

    const auth = createAospAuthService();
    const result = await auth.signIn();

    expect(mockAuthorize).toHaveBeenCalledTimes(1);
    expect(result.email).toBe("user@gmail.com");
    expect(result.accessToken).toBe("access-token-123");
    expect(result.idToken).toBe(idToken);

    // Verify saved to AsyncStorage
    const stored = JSON.parse(mockStore[STORAGE_KEYS.AOSP_AUTH_STATE]);
    expect(stored.accessToken).toBe("access-token-123");
    expect(stored.refreshToken).toBe("refresh-token-456");
    expect(stored.email).toBe("user@gmail.com");
  });

  it("signIn should throw on user cancellation", async () => {
    mockAuthorize.mockRejectedValue(new Error("User cancelled"));

    const auth = createAospAuthService();
    await expect(auth.signIn()).rejects.toThrow("User cancelled");
  });

  it("signOut should call revoke and clear storage", async () => {
    mockStore[STORAGE_KEYS.AOSP_AUTH_STATE] = JSON.stringify({
      accessToken: "at",
      refreshToken: "rt",
      idToken: "it",
      email: "user@gmail.com",
      expirationDate: "2099-01-01T00:00:00Z",
    });
    mockRevoke.mockResolvedValue(undefined);

    const auth = createAospAuthService();
    await auth.signOut();

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockStore[STORAGE_KEYS.AOSP_AUTH_STATE]).toBeUndefined();
  });

  it("signOut should clear storage even if revoke fails", async () => {
    mockStore[STORAGE_KEYS.AOSP_AUTH_STATE] = JSON.stringify({
      accessToken: "at",
      refreshToken: "rt",
      idToken: "it",
      email: "user@gmail.com",
      expirationDate: "2099-01-01T00:00:00Z",
    });
    mockRevoke.mockRejectedValue(new Error("Network error"));

    const auth = createAospAuthService();
    await auth.signOut();

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockStore[STORAGE_KEYS.AOSP_AUTH_STATE]).toBeUndefined();
  });

  it("getAccessToken should return valid token", async () => {
    mockStore[STORAGE_KEYS.AOSP_AUTH_STATE] = JSON.stringify({
      accessToken: "valid-token",
      refreshToken: "rt",
      idToken: "it",
      email: "user@gmail.com",
      expirationDate: "2099-01-01T00:00:00Z",
    });

    const auth = createAospAuthService();
    const token = await auth.getAccessToken();
    expect(token).toBe("valid-token");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("getAccessToken should refresh expired token", async () => {
    mockStore[STORAGE_KEYS.AOSP_AUTH_STATE] = JSON.stringify({
      accessToken: "expired-token",
      refreshToken: "rt",
      idToken: "it",
      email: "user@gmail.com",
      expirationDate: "2000-01-01T00:00:00Z",
    });
    mockRefresh.mockResolvedValue({
      accessToken: "new-token",
      refreshToken: "new-rt",
      idToken: "",
      accessTokenExpirationDate: "2099-01-01T00:00:00Z",
    });

    const auth = createAospAuthService();
    const token = await auth.getAccessToken();

    expect(token).toBe("new-token");
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Verify updated in storage
    const stored = JSON.parse(mockStore[STORAGE_KEYS.AOSP_AUTH_STATE]);
    expect(stored.accessToken).toBe("new-token");
    expect(stored.refreshToken).toBe("new-rt");
  });

  it("getAccessToken should return null when refresh fails", async () => {
    mockStore[STORAGE_KEYS.AOSP_AUTH_STATE] = JSON.stringify({
      accessToken: "expired-token",
      refreshToken: "rt",
      idToken: "it",
      email: "user@gmail.com",
      expirationDate: "2000-01-01T00:00:00Z",
    });
    mockRefresh.mockRejectedValue(new Error("Refresh failed"));

    const auth = createAospAuthService();
    const token = await auth.getAccessToken();
    expect(token).toBeNull();
  });

  it("getAccessToken should return null when no token stored", async () => {
    const auth = createAospAuthService();
    const token = await auth.getAccessToken();
    expect(token).toBeNull();
  });
});

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
    ]);

    const calendar = createAospCalendarService();
    const events = await calendar.fetchEvents(1700000000000, 1700100000000);

    expect(mockGetEventInstances).toHaveBeenCalledWith(
      1700000000000,
      1700100000000,
    );
    expect(events).toEqual([
      {
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
      },
    ]);
  });

  it("fetchEvents should handle allDay events", async () => {
    mockGetEventInstances.mockResolvedValue([
      {
        id: "99",
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

  it("fetchEvents should return empty array on error", async () => {
    mockGetEventInstances.mockRejectedValue(new Error("ContentProvider error"));
    const calendar = createAospCalendarService();
    expect(await calendar.fetchEvents(0, 1000)).toEqual([]);
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

  it("getCalendarList should return empty array on error", async () => {
    mockGetCalendars.mockRejectedValue(new Error("ContentProvider error"));
    const calendar = createAospCalendarService();
    expect(await calendar.getCalendarList()).toEqual([]);
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
