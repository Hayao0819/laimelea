import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { AppState, NativeModules, Platform } from "react-native";

import { stopwatchAtom } from "../../src/atoms/timerAtoms";
import { useStopwatch } from "../../src/hooks/useStopwatch";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const DEFAULT_STOPWATCH = {
  elapsedMs: 0,
  isRunning: false,
  startedAt: null,
  laps: [] as number[],
};
const originalPlatformOS = Platform.OS;

function createWrapper(store?: ReturnType<typeof createStore>) {
  const s = store ?? createStore();
  // Pre-set atom to avoid async storage initialization issues in tests
  if (!store) {
    s.set(stopwatchAtom, DEFAULT_STOPWATCH);
  }
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store: s }, children);
  }
  return { Wrapper, store: s };
}

describe("useStopwatch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, "now").mockReturnValue(0);
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as never);
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("should start with initial state", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.laps).toEqual([]);
  });

  it("should start and increase elapsedMs", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.elapsedMs).toBe(3000);
  });

  it("uses monotonic time while the app is running", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.start();
    });
    (Date.now as jest.Mock).mockReturnValue(86_400_000);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current.elapsedMs).toBe(1_000);
  });

  it("should pause and elapsedMs should not change", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.start();
    });

    (Date.now as jest.Mock).mockReturnValue(2000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const elapsed = result.current.elapsedMs;

    act(() => {
      result.current.pause();
    });

    (Date.now as jest.Mock).mockReturnValue(5000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.elapsedMs).toBe(elapsed);
    expect(result.current.isRunning).toBe(false);
  });

  it("should resume with correct offset", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.start();
    });

    // Run 3s
    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.elapsedMs).toBe(3000);

    // Pause
    act(() => {
      result.current.pause();
    });

    // Wall clock passes 5s while paused
    (Date.now as jest.Mock).mockReturnValue(8000);

    // Resume
    act(() => {
      result.current.resume();
    });

    // Run 2s after resume
    (Date.now as jest.Mock).mockReturnValue(10000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should be 3000 (pre-pause) + 2000 (post-resume) = 5000
    expect(result.current.elapsedMs).toBe(5000);
  });

  it("should record laps", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.start();
    });

    (Date.now as jest.Mock).mockReturnValue(1000);
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    act(() => {
      result.current.lap();
    });

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.lap();
    });

    expect(result.current.laps).toHaveLength(2);
    expect(result.current.laps[0]).toBe(1000);
    expect(result.current.laps[1]).toBe(3000);
  });

  it("should not record lap when not running", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.lap();
    });

    expect(result.current.laps).toEqual([]);
  });

  it("should reset to initial state", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    act(() => {
      result.current.start();
    });

    (Date.now as jest.Mock).mockReturnValue(5000);
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.lap();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.laps).toEqual([]);
  });

  it("should register AppState listener", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useStopwatch(), { wrapper: Wrapper });
    await act(async () => {});

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  describe("persistence and restoration", () => {
    it("should persist startedAt in atom when starting", async () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });
      await act(async () => {});

      (Date.now as jest.Mock).mockReturnValue(5000);
      act(() => {
        result.current.start();
      });

      const atomState = store.get(stopwatchAtom);
      expect(atomState.startedAt).toBe(5000);
      expect(atomState.isRunning).toBe(true);
    });

    it("should set startedAt to null on pause", async () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });
      await act(async () => {});

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.pause();
      });

      const atomState = store.get(stopwatchAtom);
      expect(atomState.startedAt).toBeNull();
      expect(atomState.isRunning).toBe(false);
    });

    it("should set startedAt on resume", async () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });
      await act(async () => {});

      act(() => {
        result.current.start();
      });

      (Date.now as jest.Mock).mockReturnValue(2000);
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      act(() => {
        result.current.pause();
      });

      (Date.now as jest.Mock).mockReturnValue(5000);
      act(() => {
        result.current.resume();
      });

      const atomState = store.get(stopwatchAtom);
      expect(atomState.startedAt).toBe(3000);
      expect(atomState.isRunning).toBe(true);
    });

    it("should restore a running stopwatch and continue ticking", async () => {
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 5000,
        isRunning: true,
        startedAt: -5000,
        laps: [2000],
      });

      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.laps).toEqual([2000]);

      // Advance time and verify it keeps ticking
      // startedAtRef = Date.now(0) - elapsedMs(5000) = -5000
      // elapsed = 2000 - (-5000) + 0 = 7000
      (Date.now as jest.Mock).mockReturnValue(2000);
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.elapsedMs).toBe(7000);
    });

    it("counts time elapsed while the process was not running", async () => {
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 5000,
        isRunning: true,
        startedAt: 1000,
        laps: [],
      });
      (Date.now as jest.Mock).mockReturnValue(11000);

      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

      expect(result.current.elapsedMs).toBe(10000);
    });

    it("restores a running stopwatch after delayed storage hydration", async () => {
      let resolveStorage: ((value: string | null) => void) | undefined;
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<string | null>((resolve) => {
            resolveStorage = resolve;
          }),
      );
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

      expect(result.current.isRunning).toBe(false);
      resolveStorage?.(
        JSON.stringify({
          elapsedMs: 5000,
          isRunning: true,
          startedAt: -5000,
          laps: [2000],
        }),
      );
      await act(async () => {});

      expect(result.current).toMatchObject({
        elapsedMs: 5000,
        isRunning: true,
        laps: [2000],
      });

      (Date.now as jest.Mock).mockReturnValue(2000);
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.elapsedMs).toBe(7000);
    });

    it("restores a running Android stopwatch from elapsed time after process recreation", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getElapsedRealtimeSnapshot: jest.fn().mockResolvedValue({
          elapsedRealtimeMs: 100_000,
          bootCount: 12,
        }),
      };
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 1_000,
        isRunning: true,
        startedAt: 1_000,
        startedAtElapsedMs: 92_000,
        bootCount: 12,
        laps: [],
      });
      (Date.now as jest.Mock).mockReturnValue(86_400_000);
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

      await act(async () => {});

      expect(result.current).toMatchObject({
        elapsedMs: 8_000,
        isRunning: true,
      });
    });

    it("counts time across an Android reboot", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getElapsedRealtimeSnapshot: jest.fn().mockResolvedValue({
          elapsedRealtimeMs: 2_000,
          bootCount: 13,
        }),
      };
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 1_000,
        isRunning: true,
        startedAt: 1_000,
        startedAtElapsedMs: 92_000,
        bootCount: 12,
        laps: [],
      });
      (Date.now as jest.Mock).mockReturnValue(11_000);

      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

      await act(async () => {});

      expect(result.current).toMatchObject({
        elapsedMs: 10_000,
        isRunning: true,
      });
    });

    it("resyncs against the native clock on foreground resume after deep sleep", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      const getElapsedRealtimeSnapshot = jest
        .fn()
        .mockResolvedValueOnce({ elapsedRealtimeMs: 100_000, bootCount: 12 })
        .mockResolvedValueOnce({ elapsedRealtimeMs: 130_000, bootCount: 12 });
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getElapsedRealtimeSnapshot,
      };
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 1_000,
        isRunning: true,
        startedAt: 1_000,
        startedAtElapsedMs: 99_000,
        bootCount: 12,
        laps: [],
      });
      (Date.now as jest.Mock).mockReturnValue(2_000);
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

      await act(async () => {});

      expect(result.current.elapsedMs).toBe(1_000);

      const appStateListener = (
        AppState.addEventListener as jest.Mock
      ).mock.calls.at(-1)?.[1];

      await act(async () => {
        appStateListener("active");
        for (let index = 0; index < 20; index++) {
          await Promise.resolve();
        }
      });

      expect(getElapsedRealtimeSnapshot).toHaveBeenCalledTimes(2);
      expect(result.current.elapsedMs).toBe(31_000);
    });

    it("falls back to a plain tick on foreground resume without a native clock", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
      await act(async () => {});

      act(() => {
        result.current.start();
      });

      const appStateListener = (
        AppState.addEventListener as jest.Mock
      ).mock.calls.at(-1)?.[1];
      (Date.now as jest.Mock).mockReturnValue(4_000);
      await act(async () => {
        appStateListener("active");
        for (let index = 0; index < 20; index++) {
          await Promise.resolve();
        }
      });

      expect(result.current.elapsedMs).toBe(4_000);
    });

    it.each([
      ["negative elapsedRealtimeMs", { elapsedRealtimeMs: -1, bootCount: 1 }],
      ["non-integer bootCount", { elapsedRealtimeMs: 1_000, bootCount: 1.5 }],
      ["missing bootCount", { elapsedRealtimeMs: 1_000 }],
      ["missing elapsedRealtimeMs", { bootCount: 1 }],
      ["null snapshot", null],
      ["non-object snapshot", "not-a-snapshot"],
    ])(
      "falls back gracefully when the native snapshot is malformed (%s)",
      async (_label, snapshot) => {
        Object.defineProperty(Platform, "OS", {
          configurable: true,
          value: "android",
        });
        (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
          getElapsedRealtimeSnapshot: jest.fn().mockResolvedValue(snapshot),
        };
        const { Wrapper } = createWrapper();
        const { result } = renderHook(() => useStopwatch(), {
          wrapper: Wrapper,
        });
        await act(async () => {});

        expect(result.current.isHydrated).toBe(true);
        act(() => {
          result.current.start();
        });
        expect(result.current.isRunning).toBe(true);
      },
    );

    it("falls back gracefully when the native elapsed-realtime module throws", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getElapsedRealtimeSnapshot: jest
          .fn()
          .mockRejectedValue(new Error("native failure")),
      };
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
      await act(async () => {});

      expect(result.current.isHydrated).toBe(true);
      act(() => {
        result.current.start();
      });
      expect(result.current.isRunning).toBe(true);
    });

    it("rolls back a stopwatch action when storage rejects it", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
      await act(async () => {});
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("storage unavailable"),
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current).toMatchObject({
        elapsedMs: 0,
        isRunning: false,
        laps: [],
      });
    });

    it.each(["pause", "reset", "lap"] as const)(
      "keeps ticking when %s persistence fails",
      async (action) => {
        const { Wrapper } = createWrapper();
        const { result } = renderHook(() => useStopwatch(), {
          wrapper: Wrapper,
        });
        await act(async () => {});
        await act(async () => {
          result.current.start();
          await Promise.resolve();
          await Promise.resolve();
        });
        (Date.now as jest.Mock).mockReturnValue(1_000);
        act(() => {
          jest.advanceTimersByTime(1_000);
        });
        (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
          new Error("storage unavailable"),
        );

        await act(async () => {
          result.current[action]();
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(result.current.isRunning).toBe(true);
        const elapsedBeforeAdvance = result.current.elapsedMs;
        (Date.now as jest.Mock).mockReturnValue(2_000);
        act(() => {
          jest.advanceTimersByTime(1_000);
        });
        expect(result.current.elapsedMs).toBeGreaterThan(elapsedBeforeAdvance);
      },
    );

    it("does not persist display ticks", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
      await act(async () => {});

      act(() => {
        result.current.start();
      });
      jest.clearAllMocks();

      (Date.now as jest.Mock).mockReturnValue(5000);
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("persists the exact elapsed time when paused", async () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });
      await act(async () => {});

      act(() => {
        result.current.start();
      });
      (Date.now as jest.Mock).mockReturnValue(2025);
      act(() => {
        result.current.pause();
      });

      expect(store.get(stopwatchAtom).elapsedMs).toBe(2025);
    });

    it("should restore a paused stopwatch with correct elapsed", async () => {
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 3000,
        isRunning: false,
        startedAt: null,
        laps: [1000],
      });

      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

      expect(result.current.elapsedMs).toBe(3000);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.laps).toEqual([1000]);

      // Resuming should continue from 3000
      (Date.now as jest.Mock).mockReturnValue(1000);
      act(() => {
        result.current.resume();
      });

      (Date.now as jest.Mock).mockReturnValue(3000);
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // 3000 (previous) + 2000 (new) = 5000
      expect(result.current.elapsedMs).toBe(5000);
    });

    it("should reset abnormal state (isRunning true but startedAt null)", async () => {
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 1000,
        isRunning: true,
        startedAt: null,
        laps: [],
      });

      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });
      await act(async () => {});

      expect(result.current.elapsedMs).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });

    it("uses the newer snapshot when overlapping foreground resyncs resolve out of order", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      let resolveFirst: ((value: unknown) => void) | undefined;
      let resolveSecond: ((value: unknown) => void) | undefined;
      const getElapsedRealtimeSnapshot = jest
        .fn()
        .mockResolvedValueOnce({ elapsedRealtimeMs: 90_000, bootCount: 12 })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecond = resolve;
            }),
        );
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getElapsedRealtimeSnapshot,
      };
      const store = createStore();
      store.set(stopwatchAtom, {
        elapsedMs: 1_000,
        isRunning: true,
        startedAt: 1_000,
        startedAtElapsedMs: 89_000,
        bootCount: 12,
        laps: [],
      });
      (Date.now as jest.Mock).mockReturnValue(2_000);
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
      await act(async () => {});

      const appStateListener = (
        AppState.addEventListener as jest.Mock
      ).mock.calls.at(-1)?.[1];

      act(() => {
        appStateListener("active");
      });
      act(() => {
        appStateListener("active");
      });

      // Resolve out of order: the newer (second) request settles first
      // with the true latest elapsed time; the stale first request
      // settles afterward and must not be allowed to win.
      await act(async () => {
        resolveSecond?.({ elapsedRealtimeMs: 130_000, bootCount: 12 });
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        resolveFirst?.({ elapsedRealtimeMs: 91_000, bootCount: 12 });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getElapsedRealtimeSnapshot).toHaveBeenCalledTimes(3);
      // 130_000 - 89_000 = 41_000. If the stale first response had won,
      // this would instead read 91_000 - 89_000 = 2_000.
      expect(result.current.elapsedMs).toBe(41_000);
    });

    it("ignores a foreground resync that resolves after the stopwatch was paused", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      let resolveSnapshot: ((value: unknown) => void) | undefined;
      const getElapsedRealtimeSnapshot = jest
        .fn()
        .mockResolvedValueOnce({ elapsedRealtimeMs: 90_000, bootCount: 12 })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSnapshot = resolve;
            }),
        );
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getElapsedRealtimeSnapshot,
      };
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
      await act(async () => {});

      act(() => {
        result.current.start();
      });
      (Date.now as jest.Mock).mockReturnValue(3_000);
      act(() => {
        jest.advanceTimersByTime(3_000);
      });
      expect(result.current.elapsedMs).toBe(3_000);

      const appStateListener = (
        AppState.addEventListener as jest.Mock
      ).mock.calls.at(-1)?.[1];
      act(() => {
        appStateListener("active");
      });

      act(() => {
        result.current.pause();
      });
      const pausedElapsed = result.current.elapsedMs;
      expect(result.current.isRunning).toBe(false);

      await act(async () => {
        resolveSnapshot?.({ elapsedRealtimeMs: 999_000, bootCount: 12 });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.elapsedMs).toBe(pausedElapsed);
    });
  });
});
