import { createGmsAuthService } from "../../../src/core/platform/gms/authService";
import { createGmsCalendarService } from "../../../src/core/platform/gms/calendarService";
import { createGmsBackupService } from "../../../src/core/platform/gms/backupService";
import { createGmsSleepService } from "../../../src/core/platform/gms/sleepService";

const mockHasPlayServices = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetTokens = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
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

describe("GMS AuthService", () => {
  const auth = createGmsAuthService();

  beforeEach(() => {
    mockHasPlayServices.mockReset();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    mockGetTokens.mockReset();
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
  const calendar = createGmsCalendarService();

  it("isAvailable should return false (stub)", async () => {
    expect(await calendar.isAvailable()).toBe(false);
  });

  it("fetchEvents should return empty array", async () => {
    expect(await calendar.fetchEvents(0, 1000)).toEqual([]);
  });

  it("getCalendarList should return empty array", async () => {
    expect(await calendar.getCalendarList()).toEqual([]);
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

  it("isAvailable should return false (stub)", async () => {
    expect(await sleep.isAvailable()).toBe(false);
  });

  it("fetchSleepSessions should return empty array", async () => {
    expect(await sleep.fetchSleepSessions(0, 1000)).toEqual([]);
  });
});
