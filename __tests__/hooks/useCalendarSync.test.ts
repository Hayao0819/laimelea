import { act,renderHook } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";

import {
  calendarCacheStaleAtom,
  calendarEventsAtom,
  calendarLastSyncAtom,
  calendarListAtom,
  calendarSyncErrorAtom,
} from "../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../src/atoms/settingsAtoms";
import { syncCalendarEvents } from "../../src/core/calendar/calendarSyncService";
import { createPlatformServices } from "../../src/core/platform/factory";
import { useCalendarSync } from "../../src/hooks/useCalendarSync";
import type { CalendarEvent } from "../../src/models/CalendarEvent";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";

jest.mock("../../src/core/calendar/calendarSyncService", () => ({
  syncCalendarEvents: jest.fn(),
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

jest.mock("../../src/core/platform/factory");

const mockCreatePlatformServices =
  createPlatformServices as jest.MockedFunction<typeof createPlatformServices>;

const mockSyncCalendarEvents = syncCalendarEvents as jest.MockedFunction<
  typeof syncCalendarEvents
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
      requestPermissions: jest.fn().mockResolvedValue(true),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
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

  it("should sync via CalendarProvider service", async () => {
    const syncTimestamp = 5000000;
    mockSyncCalendarEvents.mockResolvedValue({
      events: [sampleEvent],
      syncTimestamp,
    });

    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
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
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
    expect(store.get(calendarLastSyncAtom)).toBe(syncTimestamp);
  });

  it("should set calendarSyncErrorAtom on sync error", async () => {
    mockSyncCalendarEvents.mockRejectedValue(new Error("Network failure"));

    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
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
    store.set(settingsAtom, DEFAULT_SETTINGS);
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
    store.set(settingsAtom, DEFAULT_SETTINGS);
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
    store.set(settingsAtom, DEFAULT_SETTINGS);
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
    store.set(settingsAtom, DEFAULT_SETTINGS);
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

  it("should pass visibleCalendarIds to syncCalendarEvents", async () => {
    mockSyncCalendarEvents.mockResolvedValue({
      events: [],
      syncTimestamp: Date.now(),
    });

    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      visibleCalendarIds: ["cal-1", "cal-3"],
    });
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useCalendarSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncCalendarEvents).toHaveBeenCalledWith(mockServices.calendar, [
      "cal-1",
      "cal-3",
    ]);
  });
});
