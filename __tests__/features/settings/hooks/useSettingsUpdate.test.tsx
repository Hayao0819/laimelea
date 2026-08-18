import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { useSettingsUpdate } from "../../../../src/features/settings/hooks/useSettingsUpdate";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

jest.mock("../../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => ({
    getItem: (_key: string, initialValue: unknown) => initialValue,
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <JotaiProvider store={store}>{children}</JotaiProvider>;
  };
}

describe("useSettingsUpdate", () => {
  it("fills nested defaults for legacy settings", () => {
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      cycleConfig: { cycleLengthMinutes: 1500 },
      alarmDefaults: { snoozeDurationMin: 10 },
      widgetSettings: { textColor: "#fff" },
    } as typeof DEFAULT_SETTINGS);
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.settings.cycleConfig.baseTimeMs).toBe(
      DEFAULT_SETTINGS.cycleConfig.baseTimeMs,
    );
    expect(result.current.settings.alarmDefaults.vibrationEnabled).toBe(true);
    expect(result.current.settings.widgetSettings.borderRadius).toBe(
      DEFAULT_SETTINGS.widgetSettings.borderRadius,
    );
  });

  it("keeps concurrent top-level changes when updating nested defaults", () => {
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    const { result } = renderHook(() => useSettingsUpdate(), {
      wrapper: createWrapper(store),
    });

    act(() => {
      store.set(settingsAtom, { ...DEFAULT_SETTINGS, language: "ja" });
      result.current.updateAlarmDefaults({ snoozeDurationMin: 10 });
      result.current.updateWidgetSettings({ textColor: "#fff" });
    });

    const updated = store.get(settingsAtom);
    expect(updated.language).toBe("ja");
    expect(updated.alarmDefaults.snoozeDurationMin).toBe(10);
    expect(updated.widgetSettings.textColor).toBe("#fff");
  });
});
