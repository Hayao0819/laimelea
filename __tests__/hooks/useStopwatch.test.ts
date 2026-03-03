import { act,renderHook } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";

import { useStopwatch } from "../../src/hooks/useStopwatch";

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

describe("useStopwatch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, "now").mockReturnValue(0);
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
});
