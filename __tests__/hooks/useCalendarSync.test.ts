import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import { syncCalendarEvents } from "../../src/core/calendar/calendarSyncService";
import { createPlatformServices } from "../../src/core/platform/factory";
import { useCalendarSync } from "../../src/hooks/useCalendarSync";
import type { CalendarEvent } from "../../src/models/CalendarEvent";

// Replace atomWithStorage atoms with plain atoms to avoid async storage init
// that causes act() warnings from Suspense during renderHook.
jest.mock("../../src/atoms/calendarAtoms", () => {
  const { atom } = jest.requireActual<typeof import("jotai")>("jotai");

  const mockCalendarLastSyncAtom = atom<number | null>(null);

  return {
    calendarEventsAtom: atom<CalendarEvent[]>([]),
    calendarLastSyncAtom: mockCalendarLastSyncAtom,
    calendarListAtom: atom<unknown[]>([]),
    calendarLoadingAtom: atom<boolean>(false),
    calendarSyncErrorAtom: atom<string | null>(null),

    calendarCacheStaleAtom: atom((get: any) => {
      const lastSync = get(mockCalendarLastSyncAtom) as number | null;
      if (lastSync == null) return true;
      return Date.now() - lastSync > 5 * 60 * 1000;
    }),
    calendarSelectedDateAtom: atom<number>(Date.now()),
    CALENDAR_CACHE_TTL_MS: 5 * 60 * 1000,
  };
});

// Import after mock so we get the mock atoms
import {
  calendarCacheStaleAtom,
  calendarEventsAtom,
  calendarLastSyncAtom,
  calendarListAtom,
  calendarSyncErrorAtom,
} from "../../src/atoms/calendarAtoms";

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
    requestPermissions: jest.fn().mockResolvedValue(true),
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

function createStoreWithDefaults() {
  const store = createStore();
  store.set(calendarEventsAtom, []);
  store.set(calendarLastSyncAtom, null);
  store.set(calendarListAtom, []);
  return store;
}

function createWrapper(storeOverride?: ReturnType<typeof createStore>) {
  const store = storeOverride ?? createStoreWithDefaults();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

async function renderCalendarSyncHook(
  storeOverride?: ReturnType<typeof createStore>,
) {
  const store = storeOverride ?? createStoreWithDefaults();
  const { Wrapper } = createWrapper(store);
  const hookResult = renderHook(() => useCalendarSync(), {
    wrapper: Wrapper,
  });
  await act(async () => {}); // flush pending async updates
  return { ...hookResult, store };
}

describe("useCalendarSync", () => {
  let mockServices: ReturnType<typeof createMockServicesResult>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServices = createMockServicesResult();
    mockCreatePlatformServices.mockReturnValue(mockServices);
  });

  it("should return initial state with empty events, loading false, and error null", async () => {
    const { result } = await renderCalendarSyncHook();

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

    const { result, store } = await renderCalendarSyncHook();

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncCalendarEvents).toHaveBeenCalledWith(mockServices.calendar);
    expect(store.get(calendarEventsAtom)).toEqual([sampleEvent]);
    expect(store.get(calendarLastSyncAtom)).toBe(syncTimestamp);
  });

  it("should set calendarSyncErrorAtom on sync error", async () => {
    mockSyncCalendarEvents.mockRejectedValue(new Error("Network failure"));

    const { result, store } = await renderCalendarSyncHook();

    let syncError: unknown;
    await act(async () => {
      try {
        await result.current.sync(true);
      } catch (e) {
        syncError = e;
      }
    });

    // sync() should not throw - errors are caught internally
    expect(syncError).toBeUndefined();
    // Verify error is stored in the atom
    expect(store.get(calendarSyncErrorAtom)).toBe("Network failure");
    expect(result.current.loading).toBe(false);
  });

  it("should skip sync when isStale is false and force is false", async () => {
    mockSyncCalendarEvents.mockResolvedValue({
      events: [],
      syncTimestamp: Date.now(),
    });

    const store = createStoreWithDefaults();
    // Set lastSync to now so cache is not stale
    store.set(calendarLastSyncAtom, Date.now());

    // Verify cache is not stale
    expect(store.get(calendarCacheStaleAtom)).toBe(false);

    const { result } = await renderCalendarSyncHook(store);

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

    const store = createStoreWithDefaults();
    // Set lastSync to now so cache is not stale
    store.set(calendarLastSyncAtom, Date.now());

    expect(store.get(calendarCacheStaleAtom)).toBe(false);

    const { result } = await renderCalendarSyncHook(store);

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

    const { result, store } = await renderCalendarSyncHook();

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

    const { result, store } = await renderCalendarSyncHook();

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

  it("should not pass visibleCalendarIds to syncCalendarEvents", async () => {
    mockSyncCalendarEvents.mockResolvedValue({
      events: [],
      syncTimestamp: Date.now(),
    });

    const { result } = await renderCalendarSyncHook();

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSyncCalendarEvents).toHaveBeenCalledWith(mockServices.calendar);
  });
});
