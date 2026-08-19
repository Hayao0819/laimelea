import notifee from "@notifee/react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import {
  enqueueAlarmFiringNavigation,
  resetAlarmFiringNavigation,
} from "../../src/app/navigation";
import { useNotificationRuntime } from "../../src/app/useNotificationRuntime";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    getInitialNotification: jest.fn(),
    onForegroundEvent: jest.fn(() => jest.fn()),
  },
  EventType: { DELIVERED: 1, PRESS: 2, ACTION_PRESS: 3 },
}));

jest.mock("../../src/app/navigation", () => ({
  enqueueAlarmFiringNavigation: jest.fn(),
  resetAlarmFiringNavigation: jest.fn(),
}));

function createWrapper() {
  const store = createStore();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return Wrapper;
}

describe("useNotificationRuntime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("navigates to the alarm carried by the initial notification", async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: { data: { alarmId: "alarm-1" } },
    });
    const Wrapper = createWrapper();

    renderHook(() => useNotificationRuntime(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(enqueueAlarmFiringNavigation).toHaveBeenCalledWith("alarm-1");
    });
  });

  it("does nothing when there is no initial notification", async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue(null);
    const Wrapper = createWrapper();

    renderHook(() => useNotificationRuntime(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(notifee.getInitialNotification).toHaveBeenCalled();
    });
    expect(enqueueAlarmFiringNavigation).not.toHaveBeenCalled();
  });

  it("does nothing when the initial notification carries no alarmId", async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: { data: {} },
    });
    const Wrapper = createWrapper();

    renderHook(() => useNotificationRuntime(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(notifee.getInitialNotification).toHaveBeenCalled();
    });
    expect(enqueueAlarmFiringNavigation).not.toHaveBeenCalled();
  });

  it("resets alarm firing navigation on unmount", () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue(null);
    const Wrapper = createWrapper();

    const { unmount } = renderHook(() => useNotificationRuntime(), {
      wrapper: Wrapper,
    });
    unmount();

    expect(resetAlarmFiringNavigation).toHaveBeenCalled();
  });
});
