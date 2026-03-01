import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { useCalendarSync } from "../../src/hooks/useCalendarSync";
import {
  calendarEventsAtom,
  calendarLastSyncAtom,
  calendarSyncErrorAtom,
  calendarListAtom,
  calendarCacheStaleAtom,
} from "../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";
import {
  syncCalendarEvents,
  syncMultiAccountCalendarEvents,
} from "../../src/core/calendar/calendarSyncService";
import { createPlatformServices } from "../../src/core/platform/factory";
import type { CalendarEvent } from "../../src/models/CalendarEvent";

jest.mock("../../src/core/calendar/calendarSyncService", () => ({
  syncCalendarEvents: jest.fn(),
  syncMultiAccountCalendarEvents: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getTokens: jest.fn(),
    configure: jest.fn(),
  },
}));

jest.mock("react-native-app-auth", () => ({
  authorize: jest.fn(),
  refresh: jest.fn(),
  revoke: jest.fn(),
}));

jest.mock("../../src/core/platform/factory");

const mockCreatePlatformServices =
  createPlatformServices as jest.MockedFunction<typeof createPlatformServices>;

const mockSyncCalendarEvents = syncCalendarEvents as jest.MockedFunction<
  typeof syncCalendarEvents
>;

const mockSyncMultiAccountCalendarEvents =
  syncMultiAccountCalendarEvents as jest.MockedFunction<
    typeof syncMultiAccountCalendarEvents
  >;

const sampleEvent: CalendarEvent = {
  id: "ev1",
  sourceEventId: "src-ev1",
  source: "google",
  title: "Test Event",
  description: "A test event",
  startTimestampMs: 1000000,
  endTimestampMs: 2000000,
  allDay: false,
  colorId: null,
  calendarName: "Primary",
  calendarId: "cal1",
};

function createMockCalendar() {
  return {
    fetchEvents: jest.fn().mockResolvedValue([]),
    getCalendarList: jest.fn().mockResolvedValue([]),
    isAvailable: jest.fn().mockResolvedValue(true),
  };
}

function createMockAccountManager() {
  return {
    getAccounts: jest.fn().mockResolvedValue([]),
    addAccount: jest.fn().mockRejectedValue(new Error("not implemented")),
    removeAccount: jest.fn().mockResolvedValue(undefined),
    getAccessToken: jest.fn().mockResolvedValue(null),
    getAllAccessTokens: jest.fn().mockResolvedValue(new Map()),
  };
}

function createMockServicesResult(
  calendarOverride?: ReturnType<typeof createMockCalendar>,
) {
  const calendar = calendarOverride ?? createMockCalendar();
  return {
    type: "aosp" as const,
    auth: {
      signIn: jest
        .fn()
        .mockResolvedValue({ email: "", accessToken: "", idToken: "" }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest.fn().mockResolvedValue("token"),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    calendar,
    backup: {
      backup: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(null),
      getLastBackupTime: jest.fn().mockResolvedValue(null),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    sleep: {
      fetchSleepSessions: jest.fn().mockResolvedValue([]),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    accountManager: createMockAccountManager(),
  };
}

function createWrapper(storeOverride?: ReturnType<typeof createStore>) {
  const store = storeOverride ?? createStore();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

describe("useCalendarSync", () => {
  let mockServices: ReturnType<typeof createMockServicesResult>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServices = createMockServicesResult();
    mockCreatePlatformServices.mockReturnValue(mockServices);
  });

  it("should return initial state with empty events, loading false, and error null", () => {
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should use legacy sync when accounts is empty and accountEmail is set", async () => {
    const syncTimestamp = 5000000;
    mockSyncCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp,
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: "legacy@example.com",
      accounts: [],
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncCalendarEvents).toHaveBeenCalledWith(
      mockServices.calendar,
      undefined,
    );
    expect(mockSyncMultiAccountCalendarEvents).not.toHaveBeenCalled();
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
    expect(store.get(calendarLastSyncAtom)).toBe(syncTimestamp);
  });

  it("should use multi-account sync when accounts has entries", async () => {
    const syncTimestamp = 6000000;
    mockSyncMultiAccountCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp,
      errors: [],
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accounts: [
        {
          email: "user@example.com",
          displayName: "User",
          photoUrl: null,
          provider: "app-auth" as const,
          addedAt: 1000,
        },
      ],
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncMultiAccountCalendarEvents).toHaveBeenCalledWith(
      mockServices.accountManager,
      undefined,
    );
    expect(mockSyncCalendarEvents).not.toHaveBeenCalled();
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
    expect(store.get(calendarLastSyncAtom)).toBe(syncTimestamp);
  });

  it("should return empty events when no accounts and no legacy auth", async () => {
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: null,
      accounts: [],
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncCalendarEvents).not.toHaveBeenCalled();
    expect(mockSyncMultiAccountCalendarEvents).not.toHaveBeenCalled();
    expect(store.get(calendarEventsAtom)).toEqual([]);
    expect(store.get(calendarLastSyncAtom)).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it("should set error when multi-account sync has errors and no events", async () => {
    mockSyncMultiAccountCalendarEvents.mockResolvedValue({
      events: [],
      syncTimestamp: Date.now(),
      errors: [
        { email: "a@example.com", error: "Token expired" },
        { email: "b@example.com", error: "API down" },
      ],
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accounts: [
        {
          email: "a@example.com",
          displayName: "A",
          photoUrl: null,
          provider: "app-auth" as const,
          addedAt: 1000,
        },
      ],
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(result.current.error).toBe("Token expired; API down");
  });

  it("should not set error when multi-account sync has errors but also events", async () => {
    mockSyncMultiAccountCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp: Date.now(),
      errors: [{ email: "bad@example.com", error: "Token expired" }],
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accounts: [
        {
          email: "good@example.com",
          displayName: "Good",
          photoUrl: null,
          provider: "app-auth" as const,
          addedAt: 1000,
        },
      ],
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(result.current.error).toBeNull();
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
  });

  it("should set calendarSyncErrorAtom on sync error", async () => {
    mockSyncCalendarEvents.mockRejectedValue(new Error("Network failure"));

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: "user@example.com",
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(store.get(calendarSyncErrorAtom)).toBe("Network failure");
    expect(result.current.error).toBe("Network failure");
  });

  it("should skip sync when isStale is false and force is false", async () => {
    mockSyncCalendarEvents.mockResolvedValue({
      events: [],
      syncTimestamp: Date.now(),
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: "user@example.com",
    });
    // Set lastSync to now so cache is not stale
    store.set(calendarLastSyncAtom, Date.now());
    const { Wrapper } = createWrapper(store);

    // Verify cache is not stale
    expect(store.get(calendarCacheStaleAtom)).toBe(false);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync();
    });

    expect(mockSyncCalendarEvents).not.toHaveBeenCalled();
  });

  it("should force sync even when isStale is false", async () => {
    const syncTimestamp = Date.now();
    mockSyncCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp,
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: "user@example.com",
    });
    // Set lastSync to now so cache is not stale
    store.set(calendarLastSyncAtom, Date.now());
    const { Wrapper } = createWrapper(store);

    expect(store.get(calendarCacheStaleAtom)).toBe(false);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncCalendarEvents).toHaveBeenCalled();
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
  });

  it("should call getCalendarList and update calendarListAtom after successful sync", async () => {
    const calendars = [
      { id: "cal1", name: "Primary", color: "#0000ff", isPrimary: true },
    ];
    const mockCalendar = createMockCalendar();
    mockCalendar.getCalendarList.mockResolvedValue(calendars);
    mockServices = createMockServicesResult(mockCalendar);
    mockCreatePlatformServices.mockReturnValue(mockServices);

    mockSyncCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp: Date.now(),
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: "user@example.com",
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockCalendar.getCalendarList).toHaveBeenCalled();
    expect(store.get(calendarListAtom)).toEqual(calendars);
  });

  it("should ignore getCalendarList error and still succeed sync", async () => {
    const mockCalendar = createMockCalendar();
    mockCalendar.getCalendarList.mockRejectedValue(
      new Error("Calendar list failed"),
    );
    mockServices = createMockServicesResult(mockCalendar);
    mockCreatePlatformServices.mockReturnValue(mockServices);

    mockSyncCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp: 9999999,
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      accountEmail: "user@example.com",
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    // Sync itself should succeed despite getCalendarList failing
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
    expect(store.get(calendarLastSyncAtom)).toBe(9999999);
    expect(result.current.error).toBeNull();
    // Calendar list should remain at default (empty)
    expect(store.get(calendarListAtom)).toEqual([]);
  });
});
