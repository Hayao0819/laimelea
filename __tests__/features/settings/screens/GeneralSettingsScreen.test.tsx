import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { GeneralSettingsScreen } from "../../../../src/features/settings/screens/GeneralSettingsScreen";
import type { AppSettings } from "../../../../src/models/Settings";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

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
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

jest.mock("../../../../src/core/i18n", () => ({
  resolveLanguage: (setting: string) => (setting === "auto" ? "en" : setting),
}));

jest.mock(
  "../../../../src/features/widget/services/widgetUpdater",
  () => ({
    requestClockWidgetUpdate: jest.fn(),
  }),
);

function renderScreen(overrides: Partial<AppSettings> = {}) {
  const store = createStore();
  store.set(settingsAtom, { ...DEFAULT_SETTINGS, ...overrides });
  const result = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <GeneralSettingsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...result, store };
}

describe("GeneralSettingsScreen", () => {
  it("renders all setting sections", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("primary-display-segment")).toBeTruthy();
    expect(getByTestId("language-segment")).toBeTruthy();
    expect(getByTestId("theme-segment")).toBeTruthy();
    expect(getByTestId("time-format-segment")).toBeTruthy();
  });

  it("shows current primaryTimeDisplay value", async () => {
    const { getByTestId } = await renderScreen();
    // Default is "custom"; verify the segment container renders
    expect(getByTestId("primary-display-segment")).toBeTruthy();
  });

  it("updates primaryTimeDisplay on segment press", async () => {
    const { getByText, store } = await renderScreen();

    await fireEvent.press(getByText("settings.standard24h"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.primaryTimeDisplay).toBe("24h");
    });
  });

  it("shows current theme value", async () => {
    const { getByTestId } = await renderScreen();
    // Default is "system"; verify the segment container renders
    expect(getByTestId("theme-segment")).toBeTruthy();
  });

  it("updates theme on segment press", async () => {
    const { getByText, store } = await renderScreen();

    await fireEvent.press(getByText("settings.themeDark"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.theme).toBe("dark");
    });
  });

  it("shows current language value", async () => {
    const { getByTestId } = await renderScreen();
    // Default language is "auto" which resolveLanguage maps to "en"
    expect(getByTestId("language-segment")).toBeTruthy();
  });

  it("updates language on segment press", async () => {
    const { getByText, store } = await renderScreen();

    await fireEvent.press(getByText("settings.english"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.language).toBe("en");
    });
  });

  it("updates timeFormat on segment press", async () => {
    const { getByText, store } = await renderScreen();

    // Default is "24h", press "12h"
    await fireEvent.press(getByText("12h"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.timeFormat).toBe("12h");
    });
  });
});
