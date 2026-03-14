import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { CycleConfigScreen } from "../../../../src/features/settings/screens/CycleConfigScreen";
import { requestClockWidgetUpdate } from "../../../../src/features/widget/services/widgetUpdater";
import type { AppSettings } from "../../../../src/models/Settings";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => {
    const store = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        store.has(key) ? store.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

const mockWidgetUpdate = requestClockWidgetUpdate as jest.MockedFunction<
  typeof requestClockWidgetUpdate
>;

async function renderScreen(settingsOverride?: Partial<AppSettings>) {
  const store = createStore();
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  store.set(settingsAtom, settings);
  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <CycleConfigScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

describe("CycleConfigScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders cycle config screen", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("cycle-config-screen")).toBeTruthy();
  });

  it("displays current cycle hours and minutes", async () => {
    const { getByTestId } = await renderScreen();
    const hoursInput = getByTestId("cycle-hours-input");
    const minutesInput = getByTestId("cycle-minutes-input");
    // Default: 1560 minutes = 26h 0min
    expect(hoursInput.props.value).toBe("26");
    expect(minutesInput.props.value).toBe("0");
  });

  it("updates cycle hours", async () => {
    const { getByTestId, store } = await renderScreen();
    const hoursInput = getByTestId("cycle-hours-input");

    await fireEvent.changeText(hoursInput, "28");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      // 28 * 60 + 0 = 1680
      expect(updated.cycleConfig.cycleLengthMinutes).toBe(1680);
    });
    expect(mockWidgetUpdate).toHaveBeenCalled();
  });

  it("updates cycle minutes", async () => {
    const { getByTestId, store } = await renderScreen();
    const minutesInput = getByTestId("cycle-minutes-input");

    await fireEvent.changeText(minutesInput, "30");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      // 26 * 60 + 30 = 1590
      expect(updated.cycleConfig.cycleLengthMinutes).toBe(1590);
    });
    expect(mockWidgetUpdate).toHaveBeenCalled();
  });

  it("handles non-numeric input gracefully", async () => {
    const { getByTestId, store } = await renderScreen();
    const hoursInput = getByTestId("cycle-hours-input");

    await fireEvent.changeText(hoursInput, "abc");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      // parseInt("abc", 10) || 0 => 0; 0 * 60 + 0 = 0
      expect(updated.cycleConfig.cycleLengthMinutes).toBe(0);
    });
  });

  it("displays base time when set", async () => {
    const baseTimeMs = new Date("2025-06-15T10:30:00").getTime();
    const { getByText } = await renderScreen({
      cycleConfig: {
        cycleLengthMinutes: 1560,
        baseTimeMs,
      },
    });
    // date-fns format produces "2025-06-15 10:30:00"
    expect(getByText("2025-06-15 10:30:00")).toBeTruthy();
  });

  it("displays 'not set' when baseTimeMs is 0", async () => {
    const { getByText } = await renderScreen({
      cycleConfig: {
        cycleLengthMinutes: 1560,
        baseTimeMs: 0,
      },
    });
    expect(getByText("common.notSet")).toBeTruthy();
  });

  it("updates base time on 'use current time' press", async () => {
    const { getByTestId, store } = await renderScreen();
    const before = Date.now();

    await fireEvent.press(getByTestId("use-current-time-button"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.cycleConfig.baseTimeMs).toBeGreaterThanOrEqual(before);
      expect(updated.cycleConfig.baseTimeMs).toBeLessThanOrEqual(Date.now());
    });
    expect(mockWidgetUpdate).toHaveBeenCalled();
  });
});
