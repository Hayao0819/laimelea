import notifee from "@notifee/react-native";
import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { AppState } from "react-native";

import { timersAtom } from "../../src/atoms/timerAtoms";
import { STORAGE_KEYS } from "../../src/core/storage/keys";
import { useTimers } from "../../src/hooks/useTimers";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue("timer"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  },
  AndroidImportance: { DEFAULT: 3 },
  TriggerType: { TIMESTAMP: 0 },
}));

const storage: Record<string, string> = {};

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
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should start with empty timers array", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });
    await act(async () => {});

    expect(result.current.timers).toEqual([]);
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
});
