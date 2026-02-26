import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { useTimers } from "../../src/hooks/useTimers";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue("timer"),
  },
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

function createWrapper() {
  const store = createStore();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

describe("useTimers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, "now").mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should start with empty timers array", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    expect(result.current.timers).toEqual([]);
  });

  it("should add a timer that is immediately running", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000);
    });

    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0].durationMs).toBe(10000);
    expect(result.current.timers[0].remainingMs).toBe(10000);
    expect(result.current.timers[0].isRunning).toBe(true);
  });

  it("should decrease remainingMs on tick", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000);
    });

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.timers[0].remainingMs).toBe(7000);
  });

  it("should support multiple timers running independently", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000, "Timer A");
    });

    (Date.now as jest.Mock).mockReturnValue(2000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.addTimer(5000, "Timer B");
    });

    (Date.now as jest.Mock).mockReturnValue(4000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.timers).toHaveLength(2);
    expect(result.current.timers[0].remainingMs).toBe(6000);
    expect(result.current.timers[1].remainingMs).toBe(3000);
  });

  it("should stop timer at 0 when completed", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(5000);
    });

    (Date.now as jest.Mock).mockReturnValue(6000);
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.timers[0].remainingMs).toBe(0);
    expect(result.current.timers[0].isRunning).toBe(false);
  });

  it("should pause only the targeted timer", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000, "A");
    });
    act(() => {
      result.current.addTimer(10000, "B");
    });

    (Date.now as jest.Mock).mockReturnValue(2000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const idA = result.current.timers[0].id;

    act(() => {
      result.current.pauseTimer(idA);
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

  it("should resume with correct offset", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000);
    });

    (Date.now as jest.Mock).mockReturnValue(3000);
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.timers[0].remainingMs).toBe(7000);

    const id = result.current.timers[0].id;

    act(() => {
      result.current.pauseTimer(id);
    });

    (Date.now as jest.Mock).mockReturnValue(8000);

    act(() => {
      result.current.resumeTimer(id);
    });

    (Date.now as jest.Mock).mockReturnValue(10000);
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // 10000 - 3000 (pre-pause) - 2000 (post-resume) = 5000
    expect(result.current.timers[0].remainingMs).toBe(5000);
  });

  it("should delete a timer from the list", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000, "A");
    });
    act(() => {
      result.current.addTimer(5000, "B");
    });

    expect(result.current.timers).toHaveLength(2);

    const idA = result.current.timers[0].id;

    act(() => {
      result.current.deleteTimer(idA);
    });

    expect(result.current.timers).toHaveLength(1);
    expect(result.current.timers[0].label).toBe("B");
  });

  it("should reset timer to original duration", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTimers(), { wrapper: Wrapper });

    act(() => {
      result.current.addTimer(10000);
    });

    (Date.now as jest.Mock).mockReturnValue(4000);
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    const id = result.current.timers[0].id;

    act(() => {
      result.current.resetTimer(id);
    });

    expect(result.current.timers[0].remainingMs).toBe(10000);
    expect(result.current.timers[0].isRunning).toBe(false);
    expect(result.current.timers[0].pausedElapsed).toBe(0);
  });
});
