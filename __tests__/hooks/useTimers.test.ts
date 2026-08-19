import notifee from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { AppState, NativeModules, Platform } from "react-native";

import { timersAtom } from "../../src/atoms/timerAtoms";
import { STORAGE_KEYS } from "../../src/core/storage/keys";
import { normalizeTimers } from "../../src/core/storage/timerState";
import {
  InvalidTimerDurationError,
  TimerStateLoadingError,
  useTimers,
} from "../../src/hooks/useTimers";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue("timer"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
    getNotificationSettings: jest.fn().mockResolvedValue({
      authorizationStatus: 1,
      android: { alarm: 1 },
    }),
  },
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationSetting: { DISABLED: 0 },
  AuthorizationStatus: { AUTHORIZED: 1 },
  TriggerType: { TIMESTAMP: 0 },
}));

const storage: Record<string, string> = {};
const originalPlatformOS = Platform.OS;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(storage[key] ?? null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

function createWrapper() {
  const store = createStore();
  store.set(timersAtom, []);
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

describe("useTimers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, "now").mockReturnValue(0);
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as never);
    jest.clearAllMocks();
    for (const key of Object.keys(storage)) delete storage[key];
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

  it("should start with empty timers array", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    await act(async () => {});

    expect(result.current.timers).toEqual([]);
  });

  it("does not mutate timers before persisted state is hydrated", async () => {
    let resolveStorage: ((value: string | null) => void) | undefined;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveStorage = resolve;
        }),
    );
    const store = createStore();
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await expect(result.current.addTimer(10_000)).rejects.toBeInstanceOf(
      TimerStateLoadingError,
    );
    expect(result.current.timers).toEqual([]);

    await act(async () => {
      resolveStorage?.(JSON.stringify([]));
      await Promise.resolve();
    });
    expect(result.current.isHydrated).toBe(true);
  });

  it("should add a timer after its trigger is registered", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000);
    });

    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0].durationMs).toBe(10000);
    expect(result.current.timers[0].remainingMs).toBe(10000);
    expect(result.current.timers[0].isRunning).toBe(true);
  });

  it("rejects non-finite and fractional durations", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await expect(result.current.addTimer(Infinity)).rejects.toBeInstanceOf(
      InvalidTimerDurationError,
    );
    await expect(result.current.addTimer(1.5)).rejects.toBeInstanceOf(
      InvalidTimerDurationError,
    );
    expect(result.current.timers).toEqual([]);
  });

  it("does not retain a timer when its state cannot be persisted", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    await act(async () => {});
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    await act(async () => {
      await expect(result.current.addTimer(10_000)).rejects.toThrow(
        "storage unavailable",
      );
    });
    expect(result.current.timers).toEqual([]);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it("should decrease remainingMs on tick", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000);
    });

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.timers[0].remainingMs).toBe(7000);
  });

  it("uses monotonic time while the app is running", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10_000);
    });
    (Date.now as jest.Mock).mockReturnValue(86_400_000);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current.timers[0].remainingMs).toBe(9_000);
  });

  it("does not persist display ticks before a timer completes", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000);
    });
    jest.clearAllMocks();

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    (Date.now as jest.Mock).mockReturnValue(11000);
    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("should support multiple timers running independently", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000, "Timer A");
    });

    (Date.now as jest.Mock).mockReturnValue(2000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await act(async () => {
      await result.current.addTimer(5000, "Timer B");
    });

    (Date.now as jest.Mock).mockReturnValue(4000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.timers).toHaveLength(2);
    expect(result.current.timers[0].remainingMs).toBe(6000);
    expect(result.current.timers[1].remainingMs).toBe(3000);
  });

  it("serializes concurrent additions without dropping either timer", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await Promise.all([
        result.current.addTimer(10_000, "First"),
        result.current.addTimer(20_000, "Second"),
      ]);
    });

    expect(result.current.timers.map((timer) => timer.label)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("restores Android timer progress from elapsed time after process recreation", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer: jest.fn(),
      cancelTimer: jest.fn(),
      consumeCompletedTimers: jest.fn().mockResolvedValue([]),
      getTimerRemainingMs: jest.fn().mockResolvedValue(7_000),
    };
    const store = createStore();
    store.set(timersAtom, [
      {
        id: "native-timer",
        label: "Native",
        durationMs: 10_000,
        remainingMs: 9_000,
        isRunning: true,
        startedAt: 1_000,
        pausedElapsedMs: 1_000,
      },
    ]);
    (Date.now as jest.Mock).mockReturnValue(86_400_000);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }

    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    await act(async () => {});

    expect(result.current.timers[0]).toMatchObject({
      remainingMs: 7_000,
      pausedElapsedMs: 3_000,
    });
  });

  it("registers a persisted running timer missing from native state", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    const scheduleTimer = jest.fn().mockResolvedValue(undefined);
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer,
      cancelTimer: jest.fn().mockResolvedValue(undefined),
      consumeCompletedTimers: jest.fn().mockResolvedValue([]),
      getTimerRemainingMs: jest.fn().mockResolvedValue(null),
      getScheduledTimerIds: jest.fn().mockResolvedValue([]),
    };
    const store = createStore();
    store.set(timersAtom, [
      {
        id: "missing-native-timer",
        label: "Recovered",
        durationMs: 10_000,
        remainingMs: 10_000,
        isRunning: true,
        startedAt: 0,
        pausedElapsedMs: 0,
      },
    ]);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }

    renderHook(() => useTimers(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(scheduleTimer).toHaveBeenCalledWith(
        "missing-native-timer",
        "Recovered",
        expect.any(Number),
      );
    });
    const remainingMs = scheduleTimer.mock.calls[0][2] as number;
    expect(remainingMs).toBeGreaterThan(9_000);
    expect(remainingMs).toBeLessThanOrEqual(10_000);
  });

  it("cancels a native timer missing from persisted state", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    const cancelTimer = jest.fn().mockResolvedValue(undefined);
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer: jest.fn().mockResolvedValue(undefined),
      cancelTimer,
      consumeCompletedTimers: jest.fn().mockResolvedValue([]),
      getTimerRemainingMs: jest.fn().mockResolvedValue(null),
      getScheduledTimerIds: jest.fn().mockResolvedValue(["orphan-timer"]),
    };
    const { Wrapper } = createWrapper();

    renderHook(() => useTimers(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(cancelTimer).toHaveBeenCalledWith("orphan-timer");
    });
  });

  it("should stop timer at 0 when completed", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(5000);
    });

    (Date.now as jest.Mock).mockReturnValue(6000);
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.timers[0].remainingMs).toBe(0);
    expect(result.current.timers[0].isRunning).toBe(false);
  });

  it("does not redisplay a completion notification after background completion", async () => {
    const { Wrapper, store } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    act(() => {
      store.set(timersAtom, [
        {
          id: "timer-completed-in-background",
          label: "Background timer",
          durationMs: 5000,
          remainingMs: 1000,
          isRunning: true,
          startedAt: 0,
          pausedElapsedMs: 0,
        },
      ]);
    });
    storage[STORAGE_KEYS.TIMER_COMPLETIONS] = JSON.stringify([
      "timer-completed-in-background",
    ]);

    const appStateListener = (AppState.addEventListener as jest.Mock).mock
      .calls[0][1];
    (Date.now as jest.Mock).mockReturnValue(6000);
    await act(async () => {
      appStateListener("active");
      await Promise.resolve();
    });

    expect(result.current.timers[0]).toMatchObject({
      remainingMs: 0,
      isRunning: false,
    });
    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  it("should pause only the targeted timer", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000, "A");
    });
    await act(async () => {
      await result.current.addTimer(10000, "B");
    });

    (Date.now as jest.Mock).mockReturnValue(2000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const idA = result.current.timers[0].id;

    await act(async () => {
      await result.current.pauseTimer(idA);
    });

    const remainingA = result.current.timers[0].remainingMs;

    (Date.now as jest.Mock).mockReturnValue(5000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.timers[0].remainingMs).toBe(remainingA);
    expect(result.current.timers[0].isRunning).toBe(false);
    expect(result.current.timers[1].isRunning).toBe(true);
    expect(result.current.timers[1].remainingMs).toBeLessThan(10000);
  });

  it("should resume with correct offset", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000);
    });

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.timers[0].remainingMs).toBe(7000);

    const id = result.current.timers[0].id;

    await act(async () => {
      await result.current.pauseTimer(id);
    });

    (Date.now as jest.Mock).mockReturnValue(8000);

    await act(async () => {
      await result.current.resumeTimer(id);
    });

    (Date.now as jest.Mock).mockReturnValue(10000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // 10000 - 3000 (pre-pause) - 2000 (post-resume) = 5000
    expect(result.current.timers[0].remainingMs).toBe(5000);
  });

  it("should delete a timer from the list", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000, "A");
    });
    await act(async () => {
      await result.current.addTimer(5000, "B");
    });

    expect(result.current.timers).toHaveLength(2);

    const idA = result.current.timers[0].id;

    await act(async () => {
      await result.current.deleteTimer(idA);
    });

    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0].label).toBe("B");
  });

  it("should reset timer to original duration", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.addTimer(10000);
    });

    (Date.now as jest.Mock).mockReturnValue(4000);
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    const id = result.current.timers[0].id;

    await act(async () => {
      await result.current.resetTimer(id);
    });

    expect(result.current.timers[0].remainingMs).toBe(10000);
    expect(result.current.timers[0].isRunning).toBe(false);
    expect(result.current.timers[0].pausedElapsedMs).toBe(0);
  });

  it("clamps a timer paused after it has already expired", async () => {
    const store = createStore();
    store.set(timersAtom, [
      {
        id: "expired-timer",
        label: "Expired",
        durationMs: 5000,
        remainingMs: 5000,
        isRunning: true,
        startedAt: 0,
        pausedElapsedMs: 0,
      },
    ]);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }
    // Clock jumps past the timer's expiry before the 100ms tick interval
    // ever fires, simulating a pause that races ahead of tick's own
    // completion detection.
    (Date.now as jest.Mock).mockReturnValue(9000);

    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.pauseTimer("expired-timer");
    });

    expect(result.current.timers[0]).toMatchObject({
      remainingMs: 0,
      isRunning: false,
      pausedElapsedMs: 5000,
    });

    const persistedTimers = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1],
    );
    expect(normalizeTimers(persistedTimers)).toEqual(persistedTimers);

    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
      "timer-expired-timer",
    );
    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  it("keeps a completion when it races with an in-flight native reconcile", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    let resolveRemaining: ((value: number) => void) | undefined;
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer: jest.fn().mockResolvedValue(undefined),
      cancelTimer: jest.fn().mockResolvedValue(undefined),
      consumeCompletedTimers: jest.fn().mockResolvedValue([]),
      getScheduledTimerIds: jest.fn().mockResolvedValue([]),
      getTimerRemainingMs: jest.fn(
        () =>
          new Promise<number>((resolve) => {
            resolveRemaining = resolve;
          }),
      ),
    };
    const store = createStore();
    store.set(timersAtom, [
      {
        id: "racing-timer",
        label: "Racing",
        durationMs: 5000,
        remainingMs: 5000,
        isRunning: true,
        startedAt: 0,
        pausedElapsedMs: 0,
      },
    ]);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }

    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    await act(async () => {});

    (Date.now as jest.Mock).mockReturnValue(6000);
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.timers[0]).toMatchObject({
      remainingMs: 0,
      isRunning: false,
    });

    await act(async () => {
      resolveRemaining?.(3000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.timers[0]).toMatchObject({
      remainingMs: 0,
      isRunning: false,
    });
  });

  describe("Notifee trigger scheduling", () => {
    it("should schedule a trigger when adding a timer", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      (Date.now as jest.Mock).mockReturnValue(1000);
      await act(async () => {
        await result.current.addTimer(10000, "Test Timer");
      });

      expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Timer",
          body: "Timer complete",
        }),
        expect.objectContaining({
          type: 0,
          timestamp: 11000,
        }),
      );
    });

    it("should cancel trigger when pausing a timer", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(10000);
      });

      const id = result.current.timers[0].id;

      await act(async () => {
        await result.current.pauseTimer(id);
      });

      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        `timer-${id}`,
      );
    });

    it("should cancel trigger when deleting a timer", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(10000);
      });

      const id = result.current.timers[0].id;

      await act(async () => {
        await result.current.deleteTimer(id);
      });

      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        `timer-${id}`,
      );
    });

    it("should cancel trigger when resetting a timer", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(10000);
      });

      const id = result.current.timers[0].id;

      await act(async () => {
        await result.current.resetTimer(id);
      });

      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        `timer-${id}`,
      );
    });

    it("should schedule a trigger when resuming a timer", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(10000);
      });

      const id = result.current.timers[0].id;

      (Date.now as jest.Mock).mockReturnValue(3000);
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await act(async () => {
        await result.current.pauseTimer(id);
      });

      jest.clearAllMocks();

      (Date.now as jest.Mock).mockReturnValue(5000);
      await act(async () => {
        await result.current.resumeTimer(id);
      });

      expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "Timer complete",
        }),
        expect.objectContaining({
          type: 0,
          timestamp: 12000,
        }),
      );
    });

    it("does not display a second notification when the trigger completes", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(5000, "Short Timer");
      });

      const id = result.current.timers[0].id;
      jest.clearAllMocks();

      (Date.now as jest.Mock).mockReturnValue(6000);
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(notifee.cancelTriggerNotification).not.toHaveBeenCalledWith(
        `timer-${id}`,
      );
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it("does not add a timer when its trigger cannot be registered", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {});
      (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Schedule failed"),
      );

      await expect(
        act(async () => {
          await result.current.addTimer(10000);
        }),
      ).rejects.toThrow("Schedule failed");

      expect(result.current.timers).toEqual([]);
    });

    it("keeps a running timer when its trigger cannot be cancelled", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.addTimer(10000);
      });
      const id = result.current.timers[0].id;
      (notifee.cancelTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Cancel failed"),
      );

      await expect(
        act(async () => {
          await result.current.pauseTimer(id);
        }),
      ).rejects.toThrow("Cancel failed");

      expect(result.current.timers[0]).toMatchObject({ isRunning: true });
    });

    it("keeps a timer when deletion cannot cancel its trigger", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.addTimer(10000);
      });
      const id = result.current.timers[0].id;
      (notifee.cancelTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Cancel failed"),
      );

      await expect(
        act(async () => {
          await result.current.deleteTimer(id);
        }),
      ).rejects.toThrow("Cancel failed");

      expect(result.current.timers).toHaveLength(1);
    });

    it("keeps a paused timer when its resumed trigger cannot be registered", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.addTimer(10000);
      });
      const id = result.current.timers[0].id;
      await act(async () => {
        await result.current.pauseTimer(id);
      });
      (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Schedule failed"),
      );

      await expect(
        act(async () => {
          await result.current.resumeTimer(id);
        }),
      ).rejects.toThrow("Schedule failed");

      expect(result.current.timers[0]).toMatchObject({
        isRunning: false,
        startedAt: null,
      });
    });

    it("keeps timer progress when reset cannot cancel its trigger", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.addTimer(10000);
      });
      const id = result.current.timers[0].id;
      (Date.now as jest.Mock).mockReturnValue(3000);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      const beforeReset = result.current.timers[0];
      (notifee.cancelTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Cancel failed"),
      );

      await expect(
        act(async () => {
          await result.current.resetTimer(id);
        }),
      ).rejects.toThrow("Cancel failed");

      expect(result.current.timers[0]).toEqual(beforeReset);
    });
  });

  describe("tick vs. queued mutation race", () => {
    it("does not let a stale tick snapshot revert a user's pause queued during the same cycle", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(5000, "A");
      });
      await act(async () => {
        await result.current.addTimer(10000, "B");
      });
      await act(async () => {
        await result.current.addTimer(10000, "C");
      });

      const idA = result.current.timers[0].id;
      const idB = result.current.timers[1].id;
      const idC = result.current.timers[2].id;

      let resolveBlockedSetItem: (() => void) | undefined;
      (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveBlockedSetItem = resolve;
          }),
      );

      // Occupy the mutation queue with a slow persist (C's pause) so a
      // subsequently queued pauseTimer(B) is registered but has not
      // started executing yet.
      const cPause = result.current.pauseTimer(idC);
      const bPause = result.current.pauseTimer(idB);

      // Flush microtasks so C's pause reaches its blocked persist call
      // (updating the ref) while B's pause is still queued behind it.
      for (let index = 0; index < 8; index++) {
        await act(async () => {
          await Promise.resolve();
        });
      }

      // Advance the clock past A's duration so the raw tick interval
      // detects a completion and captures its own (soon-to-be-stale)
      // snapshot, while the queue is still blocked on C's pause.
      (Date.now as jest.Mock).mockReturnValue(6000);
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      // Unblock C's persist, letting the queue drain: C's pause commits,
      // then B's pause commits (reading fresh state), then the
      // tick-completion persists last.
      resolveBlockedSetItem?.();
      await act(async () => {
        await cPause;
        await bPause;
      });

      // cPause/bPause only resolve once their own operations finish, not
      // once the tick-persist task queued behind them also drains — wait
      // for that too before asserting the final settled state.
      await waitFor(() => {
        expect(result.current.timers.find((t) => t.id === idA)).toMatchObject({
          isRunning: false,
          remainingMs: 0,
        });
      });
      expect(result.current.timers.find((t) => t.id === idB)).toMatchObject({
        isRunning: false,
      });
      expect(result.current.timers.find((t) => t.id === idC)).toMatchObject({
        isRunning: false,
      });
    });

    it("does not let a stale tick snapshot resurrect a timer deleted during the same cycle", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.addTimer(5000, "A");
      });
      await act(async () => {
        await result.current.addTimer(10000, "B");
      });
      await act(async () => {
        await result.current.addTimer(10000, "C");
      });

      const idA = result.current.timers[0].id;
      const idB = result.current.timers[1].id;

      let resolveBlockedSetItem: (() => void) | undefined;
      (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveBlockedSetItem = resolve;
          }),
      );

      const cPause = result.current.pauseTimer(result.current.timers[2].id);
      const bDelete = result.current.deleteTimer(idB);

      for (let index = 0; index < 8; index++) {
        await act(async () => {
          await Promise.resolve();
        });
      }

      (Date.now as jest.Mock).mockReturnValue(6000);
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      resolveBlockedSetItem?.();
      await act(async () => {
        await cPause;
        await bDelete;
      });

      expect(result.current.timers.some((t) => t.id === idB)).toBe(false);
      await waitFor(() => {
        expect(result.current.timers.find((t) => t.id === idA)).toMatchObject({
          isRunning: false,
          remainingMs: 0,
        });
      });
    });
  });

  describe("normalizeTimers repair symmetry", () => {
    it("repairs a running timer whose remaining time already reached zero", () => {
      const corrupted = {
        id: "timer-1",
        label: "Tea",
        durationMs: 60_000,
        remainingMs: 0,
        isRunning: true,
        startedAt: 1_700_000_000_000,
        pausedElapsedMs: 0,
      };

      expect(normalizeTimers([corrupted])).toEqual([
        {
          ...corrupted,
          isRunning: false,
          startedAt: null,
          pausedElapsedMs: 60_000,
        },
      ]);
    });

    it("repairs a running timer with excess pausedElapsedMs instead of dropping it", () => {
      const corrupted = {
        id: "timer-1",
        label: "Tea",
        durationMs: 60_000,
        remainingMs: 30_000,
        isRunning: true,
        startedAt: 1_700_000_000_000,
        pausedElapsedMs: 70_000,
      };

      expect(normalizeTimers([corrupted])).toEqual([
        {
          ...corrupted,
          remainingMs: 0,
          isRunning: false,
          startedAt: null,
          pausedElapsedMs: 60_000,
        },
      ]);
    });
  });

  describe("queued task rollback on persist failure", () => {
    it("rolls back native reconciliation when persistence fails", async () => {
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: "android",
      });
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        scheduleTimer: jest.fn().mockResolvedValue(undefined),
        cancelTimer: jest.fn().mockResolvedValue(undefined),
        consumeCompletedTimers: jest.fn().mockResolvedValue([]),
        getTimerRemainingMs: jest.fn().mockResolvedValue(7_000),
        getScheduledTimerIds: jest.fn().mockResolvedValue([]),
      };
      const store = createStore();
      // Await the setup write so it fully drains through the atom's
      // internal write queue before the targeted rejection below is
      // registered — otherwise the rejection could land on this write
      // instead of on reconcileNativeTimers' own persist attempt.
      await store.set(timersAtom, [
        {
          id: "native-timer",
          label: "Native",
          durationMs: 10_000,
          remainingMs: 9_000,
          isRunning: true,
          startedAt: 1_000,
          pausedElapsedMs: 1_000,
        },
      ]);
      (Date.now as jest.Mock).mockReturnValue(86_400_000);
      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(JotaiProvider, { store }, children);
      }
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("storage unavailable"),
      );

      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {});

      expect(result.current.timers[0]).toMatchObject({
        remainingMs: 9_000,
        pausedElapsedMs: 1_000,
      });
    });

    it("rolls back applyCompletedTimers when persistence fails", async () => {
      const { Wrapper, store } = createWrapper();
      const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
      await act(async () => {});
      // Await this write too, for the same reason as above: it must
      // fully settle before the rejection is registered so the rejection
      // targets applyCompletedTimers' persist attempt specifically.
      await act(async () => {
        await store.set(timersAtom, [
          {
            id: "timer-completed-in-background",
            label: "Background timer",
            durationMs: 100_000,
            remainingMs: 40_000,
            isRunning: true,
            startedAt: 0,
            pausedElapsedMs: 0,
          },
        ]);
      });
      storage[STORAGE_KEYS.TIMER_COMPLETIONS] = JSON.stringify([
        "timer-completed-in-background",
      ]);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("storage unavailable"),
      );

      const appStateListener = (AppState.addEventListener as jest.Mock).mock
        .calls[0][1];
      await act(async () => {
        appStateListener("active");
        for (let index = 0; index < 8; index++) {
          await Promise.resolve();
        }
      });

      expect(result.current.timers[0]).toMatchObject({
        id: "timer-completed-in-background",
        isRunning: true,
        remainingMs: 40_000,
      });
    });
  });
});
