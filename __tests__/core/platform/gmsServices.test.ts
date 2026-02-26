import { createGmsAuthService } from "../../../src/core/platform/gms/authService";
import { createGmsCalendarService } from "../../../src/core/platform/gms/calendarService";
import { createGmsBackupService } from "../../../src/core/platform/gms/backupService";
import { createGmsSleepService } from "../../../src/core/platform/gms/sleepService";
import type { PlatformAuthService } from "../../../src/core/platform/types";

const mockHasPlayServices = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetTokens = jest.fn();
const mockConfigure = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
    configure: (...args: unknown[]) => mockConfigure(...args),
  },
}));

const mockInitialize = jest.fn();
const mockReadRecords = jest.fn();

jest.mock("react-native-health-connect", () => ({
  initialize: (...args: unknown[]) => mockInitialize(...args),
  readRecords: (...args: unknown[]) => mockReadRecords(...args),
  SleepStageType: {
    UNKNOWN: 0,
    AWAKE: 1,
    SLEEPING: 2,
    OUT_OF_BED: 3,
    LIGHT: 4,
    DEEP: 5,
    REM: 6,
  },
}));

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

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

describe("GMS AuthService", () => {
  const auth = createGmsAuthService();

  beforeEach(() => {
    mockHasPlayServices.mockReset();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    mockGetTokens.mockReset();
  });

  it("should call GoogleSignin.configure on creation", () => {
    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      }),
    );
  });

  it("isAvailable should return true when Play Services available", async () => {
    mockHasPlayServices.mockResolvedValue(true);
    expect(await auth.isAvailable()).toBe(true);
  });

  it("isAvailable should return false when Play Services throws", async () => {
    mockHasPlayServices.mockRejectedValue(new Error("not available"));
    expect(await auth.isAvailable()).toBe(false);
  });

  it("signIn should return auth result on success", async () => {
    mockSignIn.mockResolvedValue({
      type: "success",
      data: { user: { email: "test@example.com" } },
    });
    mockGetTokens.mockResolvedValue({
      accessToken: "access-123",
      idToken: "id-456",
    });

    const result = await auth.signIn();
    expect(result).toEqual({
      email: "test@example.com",
      accessToken: "access-123",
      idToken: "id-456",
    });
  });

  it("signIn should throw when cancelled", async () => {
    mockSignIn.mockResolvedValue({ type: "cancelled" });
    await expect(auth.signIn()).rejects.toThrow("Google sign-in was cancelled");
  });

  it("signOut should call GoogleSignin.signOut", async () => {
    mockSignOut.mockResolvedValue(null);
    await auth.signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("getAccessToken should return token", async () => {
    mockGetTokens.mockResolvedValue({
      accessToken: "token-789",
      idToken: "id-000",
    });
    expect(await auth.getAccessToken()).toBe("token-789");
  });
});

describe("GMS CalendarService", () => {
  let mockAuthService: PlatformAuthService;

  beforeEach(() => {
    mockFetch.mockReset();
    mockAuthService = {
      isAvailable: jest.fn().mockResolvedValue(true),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue("test-token"),
    };
  });

  it("isAvailable should return true when token exists", async () => {
    const calendar = createGmsCalendarService(mockAuthService);
    expect(await calendar.isAvailable()).toBe(true);
  });

  it("isAvailable should return false when no token", async () => {
    (mockAuthService.getAccessToken as jest.Mock).mockResolvedValue(null);
    const calendar = createGmsCalendarService(mockAuthService);
    expect(await calendar.isAvailable()).toBe(false);
  });

  it("fetchEvents should return mapped events", async () => {
    const calendar = createGmsCalendarService(mockAuthService);

    // calendarList response
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "cal-1",
            summary: "Work",
            backgroundColor: "#0000ff",
            primary: true,
          },
        ],
      }),
    );

    // events response
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "ev-1",
            summary: "Meeting",
            description: "Standup",
            status: "confirmed",
            start: { dateTime: "2026-01-15T10:00:00Z" },
            end: { dateTime: "2026-01-15T11:00:00Z" },
          },
        ],
      }),
    );

    const events = await calendar.fetchEvents(
      new Date("2026-01-01").getTime(),
      new Date("2026-01-31").getTime(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: "google",
      title: "Meeting",
      description: "Standup",
      calendarName: "Work",
      calendarId: "cal-1",
      allDay: false,
    });
  });

  it("fetchEvents should return empty when no token", async () => {
    (mockAuthService.getAccessToken as jest.Mock).mockResolvedValue(null);
    const calendar = createGmsCalendarService(mockAuthService);
    const events = await calendar.fetchEvents(0, 1000);
    expect(events).toEqual([]);
  });

  it("fetchEvents should return empty on API error", async () => {
    const calendar = createGmsCalendarService(mockAuthService);
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    const events = await calendar.fetchEvents(0, 1000);
    expect(events).toEqual([]);
  });

  it("getCalendarList should return mapped calendars", async () => {
    const calendar = createGmsCalendarService(mockAuthService);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
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
        ],
      }),
    );

    const list = await calendar.getCalendarList();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: "cal-1",
      name: "Work",
      color: "#0000ff",
      isPrimary: true,
    });
  });

  it("getCalendarList should return empty when no token", async () => {
    (mockAuthService.getAccessToken as jest.Mock).mockResolvedValue(null);
    const calendar = createGmsCalendarService(mockAuthService);
    const list = await calendar.getCalendarList();
    expect(list).toEqual([]);
  });
});

describe("GMS BackupService", () => {
  it("isAvailable should return true", async () => {
    const backup = createGmsBackupService();
    expect(await backup.isAvailable()).toBe(true);
  });
});

describe("GMS SleepService", () => {
  const sleep = createGmsSleepService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("isAvailable should return true when initialize succeeds", async () => {
    mockInitialize.mockResolvedValue(true);
    expect(await sleep.isAvailable()).toBe(true);
  });

  it("isAvailable should return false when initialize fails", async () => {
    mockInitialize.mockRejectedValue(new Error("not installed"));
    expect(await sleep.isAvailable()).toBe(false);
  });

  it("fetchSleepSessions should return mapped sessions", async () => {
    const startTime = "2025-01-15T23:00:00.000Z";
    const endTime = "2025-01-16T07:00:00.000Z";
    mockReadRecords.mockResolvedValue({
      records: [
        {
          startTime,
          endTime,
          stages: [
            {
              startTime,
              endTime: "2025-01-16T01:00:00.000Z",
              stage: 4,
            },
            {
              startTime: "2025-01-16T01:00:00.000Z",
              endTime: "2025-01-16T03:00:00.000Z",
              stage: 5,
            },
          ],
        },
      ],
    });

    const result = await sleep.fetchSleepSessions(
      new Date(startTime).getTime(),
      new Date(endTime).getTime(),
    );

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("health_connect");
    expect(result[0].stages).toHaveLength(2);
    expect(result[0].stages[0].stage).toBe("light");
    expect(result[0].stages[1].stage).toBe("deep");
    expect(result[0].durationMs).toBe(
      new Date(endTime).getTime() - new Date(startTime).getTime(),
    );
  });

  it("fetchSleepSessions should return empty array on error", async () => {
    mockReadRecords.mockRejectedValue(new Error("permission denied"));
    expect(await sleep.fetchSleepSessions(0, 1000)).toEqual([]);
  });

  it("fetchSleepSessions should map unknown stage types to unknown", async () => {
    mockReadRecords.mockResolvedValue({
      records: [
        {
          startTime: "2025-01-15T23:00:00.000Z",
          endTime: "2025-01-16T07:00:00.000Z",
          stages: [
            {
              startTime: "2025-01-15T23:00:00.000Z",
              endTime: "2025-01-16T01:00:00.000Z",
              stage: 99,
            },
          ],
        },
      ],
    });

    const result = await sleep.fetchSleepSessions(0, Date.now());
    expect(result[0].stages[0].stage).toBe("unknown");
  });
});
