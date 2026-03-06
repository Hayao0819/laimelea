import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { AppState } from "react-native";

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
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should start with initial state", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.laps).toEqual([]);
  });

  it("should start and increase elapsedMs", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

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

  it("should pause and elapsedMs should not change", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

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

  it("should resume with correct offset", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

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

  it("should record laps", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

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

  it("should not record lap when not running", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

    act(() => {
      result.current.lap();
    });

    expect(result.current.laps).toEqual([]);
  });

  it("should reset to initial state", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });

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

  it("should register AppState listener", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useStopwatch(), { wrapper: Wrapper });

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  describe("persistence and restoration", () => {
    it("should persist startedAt in atom when starting", () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

      (Date.now as jest.Mock).mockReturnValue(5000);
      act(() => {
        result.current.start();
      });

      const atomState = store.get(stopwatchAtom);
      expect(atomState.startedAt).toBe(5000);
      expect(atomState.isRunning).toBe(true);
    });

    it("should set startedAt to null on pause", () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

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

    it("should set startedAt on resume", () => {
      const store = createStore();
      const { Wrapper } = createWrapper(store);
      const { result } = renderHook(() => useStopwatch(), {
        wrapper: Wrapper,
      });

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
      expect(atomState.startedAt).toBe(5000);
      expect(atomState.isRunning).toBe(true);
    });

    it("should restore a running stopwatch and continue ticking", () => {
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

    it("should restore a paused stopwatch with correct elapsed", () => {
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

    it("should reset abnormal state (isRunning true but startedAt null)", () => {
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

      expect(result.current.elapsedMs).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });
  });
});
