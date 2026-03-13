import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import { currentTimeMsAtom } from "../../src/atoms/clockAtoms";
import { useCurrentTime } from "../../src/hooks/useCurrentTime";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";

// Replace settingsAtom (atomWithStorage) with a plain atom to avoid async
// storage init that causes act() warnings during renderHook.
jest.mock("../../src/atoms/settingsAtoms", () => {
  const { atom } = jest.requireActual<typeof import("jotai")>("jotai");
  const { DEFAULT_SETTINGS: defaults } = jest.requireActual<
    typeof import("../../src/models/Settings")
  >("../../src/models/Settings");
  return {
    __esModule: true,
    settingsAtom: atom(defaults),
  };
});

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
  store.set(currentTimeMsAtom, 1000000);
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

describe("useCurrentTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, "now").mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should return realTimeMs and customTime", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentTime(), {
      wrapper: Wrapper,
    });

    expect(result.current.realTimeMs).toBeDefined();
    expect(result.current.customTime).toBeDefined();
    expect(result.current.customTime).toHaveProperty("day");
    expect(result.current.customTime).toHaveProperty("hours");
    expect(result.current.customTime).toHaveProperty("minutes");
    expect(result.current.customTime).toHaveProperty("seconds");
  });

  it("should update currentTimeMsAtom after 1 second", async () => {
    const { Wrapper, store } = createWrapper();
    renderHook(() => useCurrentTime(), {
      wrapper: Wrapper,
    });

    // Flush Suspense resolution so useEffect runs
    await act(async () => {});

    (Date.now as jest.Mock).mockReturnValue(1001000);

    // Advance timer to fire setInterval callback
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Verify the atom was updated in the store
    expect(store.get(currentTimeMsAtom)).toBe(1001000);
  });

  it("should clear interval on unmount", async () => {
    const clearSpy = jest.spyOn(globalThis, "clearInterval");
    const { Wrapper } = createWrapper();
    const { unmount } = renderHook(() => useCurrentTime(), {
      wrapper: Wrapper,
    });

    // Flush Suspense resolution so useEffect runs and sets up interval
    await act(async () => {});

    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
