import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { TimezoneSettingsScreen } from "../../../../src/features/settings/screens/TimezoneSettingsScreen";
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

async function renderScreen(overrides: Partial<AppSettings> = {}) {
  const store = createStore();
  store.set(settingsAtom, { ...DEFAULT_SETTINGS, ...overrides });
  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <TimezoneSettingsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

describe("TimezoneSettingsScreen", () => {
  it("restores the primary timezone to the system default", async () => {
    const { getByTestId, store } = await renderScreen({
      timezone: "Asia/Tokyo",
    });

    await fireEvent.press(getByTestId("timezone-item"));
    await fireEvent.press(getByTestId("timezone-auto-item"));

    await waitFor(() => {
      expect((store.get(settingsAtom) as AppSettings).timezone).toBe("auto");
    });
  });

  it("clears the secondary timezone", async () => {
    const { getByTestId, store } = await renderScreen({
      secondaryTimezone: "Europe/London",
    });

    await fireEvent.press(getByTestId("secondary-tz-item"));
    await fireEvent.press(getByTestId("secondary-timezone-none-item"));

    await waitFor(() => {
      expect(
        (store.get(settingsAtom) as AppSettings).secondaryTimezone,
      ).toBeNull();
    });
  });
});
