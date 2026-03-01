import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore, atom } from "jotai";
import type { SleepSession } from "../../src/models/SleepSession";
import type { CycleEstimation } from "../../src/models/SleepSession";
import type { PlatformServices } from "../../src/core/platform/types";

// Replace atomWithStorage atoms with plain atoms for testing.
// Variables prefixed with "mock" are allowed in jest.mock factory.
const mockSleepSessionsAtom = atom<SleepSession[]>([]);
const mockCycleEstimationAtom = atom<CycleEstimation | null>(null);
const mockSleepLoadingAtom = atom(false);
const mockSleepErrorAtom = atom<string | null>(null);
const mockSleepLastSyncAtom = atom<number | null>(null);
const mockSleepCacheTtlMs = 10 * 60 * 1000;
const mockSleepCacheStaleAtom = atom((get) => {
  const lastSync = get(mockSleepLastSyncAtom);
  if (lastSync == null) return true;
  return Date.now() - lastSync > mockSleepCacheTtlMs;
});

jest.mock("../../src/atoms/sleepAtoms", () => ({
  sleepSessionsAtom: mockSleepSessionsAtom,
  cycleEstimationAtom: mockCycleEstimationAtom,
  sleepLoadingAtom: mockSleepLoadingAtom,
  sleepErrorAtom: mockSleepErrorAtom,
  sleepLastSyncAtom: mockSleepLastSyncAtom,
  sleepCacheStaleAtom: mockSleepCacheStaleAtom,
  SLEEP_CACHE_TTL_MS: mockSleepCacheTtlMs,
}));

jest.mock("../../src/core/platform/factory");
jest.mock("../../src/features/sleep/services/cycleDetector");

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

// Import after mocks are set up
const { useSleepSync } = require("../../src/hooks/useSleepSync");
const { createPlatformServices } = require("../../src/core/platform/factory");
const {
  estimateCycle,
} = require("../../src/features/sleep/services/cycleDetector");

const mockCreatePlatformServices = createPlatformServices as jest.Mock;
const mockEstimateCycle = estimateCycle as jest.Mock;

function createMockSleep() {
  return {
    fetchSleepSessions: jest.fn().mockResolvedValue([]),
    isAvailable: jest.fn().mockResolvedValue(true),
  };
}

function createMockServices(
  sleepOverride?: ReturnType<typeof createMockSleep>,
): PlatformServices {
  const sleep = sleepOverride ?? createMockSleep();
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
    calendar: {
      fetchEvents: jest.fn().mockResolvedValue([]),
      getCalendarList: jest.fn().mockResolvedValue([]),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    backup: {
      backup: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(null),
      getLastBackupTime: jest.fn().mockResolvedValue(null),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    sleep,
    accountManager: {
      getAccounts: jest.fn().mockResolvedValue([]),
      addAccount: jest.fn().mockRejectedValue(new Error("not implemented")),
      removeAccount: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest.fn().mockResolvedValue(null),
      getAllAccessTokens: jest.fn().mockResolvedValue(new Map()),
    },
  };
}

const sampleSession: SleepSession = {
  id: "hc-1000-2000",
  source: "health_connect",
  startTimestampMs: 1000000,
  endTimestampMs: 1028000000,
  stages: [
    {
      startTimestampMs: 1000000,
      endTimestampMs: 1014000000,
      stage: "light",
    },
    {
      startTimestampMs: 1014000000,
      endTimestampMs: 1028000000,
      stage: "deep",
    },
  ],
  durationMs: 1027000000,
  createdAt: 1000000,
  updatedAt: 1000000,
};

function createWrapper(store: ReturnType<typeof createStore>) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

describe("useSleepSync", () => {
  let mockServices: PlatformServices;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServices = createMockServices();
    mockCreatePlatformServices.mockReturnValue(mockServices);
    mockEstimateCycle.mockReturnValue(null);
  });

  it("should return initial state with empty sessions, null estimation, loading false, and error null", () => {
    const store = createStore();
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.estimation).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should update sessions and call estimateCycle on successful sync", async () => {
    const mockSleep = createMockSleep();
    mockSleep.fetchSleepSessions.mockResolvedValue([sampleSession]);
    mockServices = createMockServices(mockSleep);
    mockCreatePlatformServices.mockReturnValue(mockServices);

    const mockEstimation = {
      periodMinutes: 1450,
      driftMinutesPerDay: 10,
      r2: 0.95,
      confidence: "high" as const,
      dataPointsUsed: 14,
    };
    mockEstimateCycle.mockReturnValue(mockEstimation);

    const store = createStore();
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(mockSleep.fetchSleepSessions).toHaveBeenCalled();
    expect(mockEstimateCycle).toHaveBeenCalledWith([sampleSession]);
    expect(store.get(mockSleepSessionsAtom)).toEqual([sampleSession]);
    expect(store.get(mockCycleEstimationAtom)).toEqual(mockEstimation);
    expect(store.get(mockSleepLastSyncAtom)).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it("should prevent concurrent sync calls via mutex", async () => {
    let resolveFirst: (value: SleepSession[]) => void;
    const firstPromise = new Promise<SleepSession[]>((resolve) => {
      resolveFirst = resolve;
    });

    const mockSleep = createMockSleep();
    mockSleep.fetchSleepSessions.mockReturnValue(firstPromise);
    mockServices = createMockServices(mockSleep);
    mockCreatePlatformServices.mockReturnValue(mockServices);

    const store = createStore();
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    // Start first sync (will be pending)
    let firstDone = false;
    act(() => {
      result.current.sync(true).then(() => {
        firstDone = true;
      });
    });

    // Attempt second sync while first is still running
    await act(async () => {
      await result.current.sync(true);
    });

    // Only one call should have been made
    expect(mockSleep.fetchSleepSessions).toHaveBeenCalledTimes(1);

    // Resolve the first promise to clean up
    await act(async () => {
      resolveFirst!([]);
    });

    expect(firstDone).toBe(true);
  });

  it("should skip sync when cache is not stale and force is false", async () => {
    const mockSleep = createMockSleep();
    mockServices = createMockServices(mockSleep);
    mockCreatePlatformServices.mockReturnValue(mockServices);

    const store = createStore();
    store.set(mockSleepLastSyncAtom, Date.now());
    const { Wrapper } = createWrapper(store);

    expect(store.get(mockSleepCacheStaleAtom)).toBe(false);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync();
    });

    expect(mockSleep.fetchSleepSessions).not.toHaveBeenCalled();
  });

  it("should set error when fetchSleepSessions throws", async () => {
    const mockSleep = createMockSleep();
    mockSleep.fetchSleepSessions.mockRejectedValue(
      new Error("Health Connect unavailable"),
    );
    mockServices = createMockServices(mockSleep);
    mockCreatePlatformServices.mockReturnValue(mockServices);

    const store = createStore();
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.sync(true);
    });

    expect(store.get(mockSleepErrorAtom)).toBe("Health Connect unavailable");
    expect(result.current.error).toBe("Health Connect unavailable");
    expect(result.current.loading).toBe(false);
  });

  it("should recalculate cycle estimation from current sessions", async () => {
    const mockEstimation = {
      periodMinutes: 1460,
      driftMinutesPerDay: 20,
      r2: 0.88,
      confidence: "medium" as const,
      dataPointsUsed: 21,
    };
    mockEstimateCycle.mockReturnValue(mockEstimation);

    const store = createStore();
    store.set(mockSleepSessionsAtom, [sampleSession]);
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      result.current.recalculate();
    });

    expect(mockEstimateCycle).toHaveBeenCalledWith([sampleSession]);
    expect(store.get(mockCycleEstimationAtom)).toEqual(mockEstimation);
  });

  it("should add a manual entry with auto-generated id, source, createdAt, and updatedAt", async () => {
    const store = createStore();
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    const manualEntry = {
      startTimestampMs: 1700000000000,
      endTimestampMs: 1700028800000,
      stages: [],
      durationMs: 28800000,
    };

    await act(async () => {
      result.current.addManualEntry(manualEntry);
    });

    const sessions = store.get(mockSleepSessionsAtom);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startTimestampMs).toBe(manualEntry.startTimestampMs);
    expect(sessions[0].endTimestampMs).toBe(manualEntry.endTimestampMs);
    expect(sessions[0].durationMs).toBe(manualEntry.durationMs);
    expect(sessions[0].stages).toEqual([]);
    expect(sessions[0].source).toBe("manual");
    expect(sessions[0].id).toMatch(/^sleep-\d+-[a-z0-9]+$/);
    expect(sessions[0].createdAt).toBeGreaterThan(0);
    expect(sessions[0].updatedAt).toBeGreaterThan(0);
    expect(sessions[0].createdAt).toBe(sessions[0].updatedAt);
  });

  it("should delete a session by id", async () => {
    const session1: SleepSession = {
      ...sampleSession,
      id: "sleep-1",
    };
    const session2: SleepSession = {
      ...sampleSession,
      id: "sleep-2",
      startTimestampMs: 2000000,
    };

    const store = createStore();
    store.set(mockSleepSessionsAtom, [session1, session2]);
    const { Wrapper } = createWrapper(store);

    const { result } = renderHook(() => useSleepSync(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      result.current.deleteEntry("sleep-1");
    });

    const sessions = store.get(mockSleepSessionsAtom);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("sleep-2");
  });
});
