import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../../src/models/Settings";
import type { AppSettings } from "../../../../src/models/Settings";
import { useSettingsUpdate } from "../../../../src/features/settings/hooks/useSettingsUpdate";
import { requestClockWidgetUpdate } from "../../../../src/features/widget/services/widgetUpdater";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock(
  "../../../../src/features/widget/services/widgetUpdater",
  () => ({
    requestClockWidgetUpdate: jest.fn(),
  }),
);

function createWrapper() {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return { Wrapper, store };
}

describe("useSettingsUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return settings merged with defaults", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("should return settings merged with defaults when rawSettings is partial", () => {
    const store = createStore();
    const partial = { setupComplete: true } as AppSettings;
    store.set(settingsAtom, partial);

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }

    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    // The hook merges DEFAULT_SETTINGS with rawSettings, so missing fields come from defaults
    expect(result.current.settings.setupComplete).toBe(true);
    expect(result.current.settings.primaryTimeDisplay).toBe(
      DEFAULT_SETTINGS.primaryTimeDisplay,
    );
    expect(result.current.settings.alarmDefaults).toEqual(
      DEFAULT_SETTINGS.alarmDefaults,
    );
  });

  it("should update partial settings via update()", () => {
    const { Wrapper, store } = createWrapper();
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.update({ setupComplete: true, theme: "dark" });
    });

    const stored = store.get(settingsAtom) as AppSettings;
    expect(stored.setupComplete).toBe(true);
    expect(stored.theme).toBe("dark");
    // Unchanged fields remain
    expect(stored.primaryTimeDisplay).toBe(
      DEFAULT_SETTINGS.primaryTimeDisplay,
    );
  });

  it("should update alarm defaults via updateAlarmDefaults()", () => {
    const { Wrapper, store } = createWrapper();
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateAlarmDefaults({
        snoozeDurationMin: 10,
        vibrationEnabled: false,
      });
    });

    const stored = store.get(settingsAtom) as AppSettings;
    expect(stored.alarmDefaults.snoozeDurationMin).toBe(10);
    expect(stored.alarmDefaults.vibrationEnabled).toBe(false);
    // Unchanged alarm defaults remain
    expect(stored.alarmDefaults.dismissalMethod).toBe(
      DEFAULT_SETTINGS.alarmDefaults.dismissalMethod,
    );
    expect(stored.alarmDefaults.snoozeMaxCount).toBe(
      DEFAULT_SETTINGS.alarmDefaults.snoozeMaxCount,
    );
  });

  it("should update widget settings via updateWidgetSettings()", () => {
    const { Wrapper, store } = createWrapper();
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateWidgetSettings({
        opacity: 80,
        showRealTime: false,
      });
    });

    const stored = store.get(settingsAtom) as AppSettings;
    expect(stored.widgetSettings.opacity).toBe(80);
    expect(stored.widgetSettings.showRealTime).toBe(false);
    // Unchanged widget settings remain
    expect(stored.widgetSettings.backgroundColor).toBe(
      DEFAULT_WIDGET_SETTINGS.backgroundColor,
    );
  });

  it("should call requestClockWidgetUpdate when updating widget settings", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateWidgetSettings({ opacity: 50 });
    });

    expect(requestClockWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it("should not call requestClockWidgetUpdate when using update()", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.update({ theme: "dark" });
    });

    expect(requestClockWidgetUpdate).not.toHaveBeenCalled();
  });

  it("should merge with DEFAULT_WIDGET_SETTINGS when widgetSettings is undefined", () => {
    const store = createStore();
    // Create settings without widgetSettings to simulate legacy stored data
    const settingsWithoutWidget = {
      ...DEFAULT_SETTINGS,
      widgetSettings: undefined,
    } as unknown as AppSettings;
    store.set(settingsAtom, settingsWithoutWidget);

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }

    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateWidgetSettings({ opacity: 75 });
    });

    const stored = store.get(settingsAtom) as AppSettings;
    // Should have merged with DEFAULT_WIDGET_SETTINGS since widgetSettings was undefined
    expect(stored.widgetSettings.opacity).toBe(75);
    expect(stored.widgetSettings.backgroundColor).toBe(
      DEFAULT_WIDGET_SETTINGS.backgroundColor,
    );
    expect(stored.widgetSettings.textColor).toBe(
      DEFAULT_WIDGET_SETTINGS.textColor,
    );
    expect(requestClockWidgetUpdate).toHaveBeenCalledTimes(1);
  });
});
