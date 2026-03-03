import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { AlarmDefaultsScreen } from "../../../../src/features/settings/screens/AlarmDefaultsScreen";
import type { AppSettings } from "../../../../src/models/Settings";
import {
  DEFAULT_ALARM_DEFAULTS,
  DEFAULT_SETTINGS,
} from "../../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

function renderScreen(settingsOverride?: Partial<AppSettings>) {
  const store = createStore();
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  store.set(settingsAtom, settings);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <AlarmDefaultsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("AlarmDefaultsScreen", () => {
  it("should render the screen", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("alarm-defaults-screen")).toBeTruthy();
  });

  it("should render dismissal method segment", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("dismissal-segment")).toBeTruthy();
  });

  it("should render gradual volume item", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("gradual-volume-item")).toBeTruthy();
  });

  it("should render snooze duration item", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("snooze-duration-item")).toBeTruthy();
  });

  it("should render snooze max item", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("snooze-max-item")).toBeTruthy();
  });

  it("should render vibration switch", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("vibration-item")).toBeTruthy();
  });

  it("should not show math difficulty when dismissalMethod is not math", async () => {
    const { queryByTestId } = await renderScreen();
    // Default dismissalMethod is "simple"
    expect(queryByTestId("math-difficulty-segment")).toBeNull();
  });

  it("should show math difficulty when dismissalMethod is math", async () => {
    const { getByTestId } = await renderScreen({
      alarmDefaults: { ...DEFAULT_ALARM_DEFAULTS, dismissalMethod: "math" },
    });
    expect(getByTestId("math-difficulty-segment")).toBeTruthy();
  });

  it("should update math difficulty on button press", async () => {
    const { getByTestId, getByText, store } = await renderScreen({
      alarmDefaults: {
        ...DEFAULT_ALARM_DEFAULTS,
        dismissalMethod: "math",
        mathDifficulty: 1,
      },
    });

    expect(getByTestId("math-difficulty-segment")).toBeTruthy();

    // Press "Medium" button
    await fireEvent.press(getByText("settings.mathDifficultyMedium"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.alarmDefaults.mathDifficulty).toBe(2);
    });
  });

  it("should cycle snooze duration on press", async () => {
    const { getByTestId, store } = await renderScreen();
    // Default is 5; cycle options: [1, 3, 5, 10, 15]
    await fireEvent.press(getByTestId("snooze-duration-item"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.alarmDefaults.snoozeDurationMin).toBe(10);
    });
  });

  it("should cycle snooze max on press", async () => {
    const { getByTestId, store } = await renderScreen();
    // Default is 3; cycle options: [1, 2, 3, 5, 10]
    await fireEvent.press(getByTestId("snooze-max-item"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.alarmDefaults.snoozeMaxCount).toBe(5);
    });
  });
});
