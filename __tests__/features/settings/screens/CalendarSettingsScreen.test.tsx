import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import {
  calendarListAtom,
  HIDE_ALL_CALENDARS_ID,
} from "../../../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { CalendarSettingsScreen } from "../../../../src/features/settings/screens/CalendarSettingsScreen";
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
    const values = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        values.has(key) ? values.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

async function renderScreen(
  settings: Partial<AppSettings> = {},
  calendars: Array<{
    id: string;
    name: string;
    color: string | null;
    isPrimary: boolean;
  }> = [],
) {
  const store = createStore();
  store.set(settingsAtom, { ...DEFAULT_SETTINGS, ...settings });
  store.set(calendarListAtom, calendars);

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <CalendarSettingsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

describe("CalendarSettingsScreen", () => {
  it("shows the empty state when no calendars are available", async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId("no-calendars-item")).toBeTruthy();
  });

  it("updates the selected first day of the week", async () => {
    const { getByText, store } = await renderScreen();

    fireEvent.press(getByText("settings.sunday"));

    await waitFor(() => {
      expect(
        (store.get(settingsAtom) as AppSettings).calendarFirstDayOfWeek,
      ).toBe(0);
    });
  });

  it("cycles the default event reminder", async () => {
    const { getByTestId, store } = await renderScreen({
      defaultEventReminderMin: 60,
    });

    fireEvent.press(getByTestId("default-reminder-item"));

    await waitFor(() => {
      expect(
        (store.get(settingsAtom) as AppSettings).defaultEventReminderMin,
      ).toBe(0);
    });
  });

  it("toggles individual calendar visibility without changing other calendars", async () => {
    const { getByTestId, store } = await renderScreen(
      { visibleCalendarIds: ["work"] },
      [
        { id: "work", name: "Work", color: "#f00", isPrimary: true },
        { id: "home", name: "Home", color: null, isPrimary: false },
      ],
    );

    fireEvent.press(getByTestId("calendar-checkbox-work"));
    fireEvent.press(getByTestId("calendar-checkbox-home"));

    await waitFor(() => {
      expect(
        (store.get(settingsAtom) as AppSettings).visibleCalendarIds,
      ).toEqual(["home"]);
    });
  });

  it("keeps all calendars selected for the legacy empty selection", async () => {
    const { getByTestId, store } = await renderScreen(
      { visibleCalendarIds: [] },
      [
        { id: "work", name: "Work", color: "#f00", isPrimary: true },
        { id: "home", name: "Home", color: null, isPrimary: false },
      ],
    );

    fireEvent.press(getByTestId("calendar-checkbox-work"));

    await waitFor(() => {
      expect(
        (store.get(settingsAtom) as AppSettings).visibleCalendarIds,
      ).toEqual(["home"]);
    });
  });

  it("represents an all-hidden selection without restoring every calendar", async () => {
    const { getByTestId, store } = await renderScreen(
      { visibleCalendarIds: ["work"] },
      [
        { id: "work", name: "Work", color: "#f00", isPrimary: true },
        { id: "home", name: "Home", color: null, isPrimary: false },
      ],
    );

    fireEvent.press(getByTestId("calendar-checkbox-work"));

    await waitFor(() => {
      expect(
        (store.get(settingsAtom) as AppSettings).visibleCalendarIds,
      ).toEqual([HIDE_ALL_CALENDARS_ID]);
    });
  });
});
