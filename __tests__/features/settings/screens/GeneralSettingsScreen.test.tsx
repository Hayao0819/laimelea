import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
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

jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

const mockRequestExclusion = jest.fn();
let mockIgnored: boolean | null = false;

jest.mock(
  "../../../../src/features/settings/hooks/useBatteryOptimization",
  () => ({
    useBatteryOptimization: () => ({
      ignored: mockIgnored,
      requestExclusion: mockRequestExclusion,
    }),
  }),
);

async function renderScreen(overrides: Partial<AppSettings> = {}) {
  const store = createStore();
  store.set(settingsAtom, { ...DEFAULT_SETTINGS, ...overrides });

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <GeneralSettingsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});

  return { ...utils, store };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIgnored = false;
  mockRequestExclusion.mockResolvedValue(undefined);
});

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

    await fireEvent.press(getByText("12h"));

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.timeFormat).toBe("12h");
    });
  });
});

describe("GeneralSettingsScreen - battery optimization", () => {
  it("renders the battery optimization item", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("battery-optimization-item")).toBeTruthy();
  });

  it("shows checking description when status is null", async () => {
    mockIgnored = null;
    const { getByText } = await renderScreen();
    expect(getByText("settings.batteryOptimizationChecking")).toBeTruthy();
  });

  it("shows excluded description when battery optimization is ignored", async () => {
    mockIgnored = true;
    const { getByText, queryByTestId } = await renderScreen();

    expect(getByText("settings.batteryOptimizationDisabled")).toBeTruthy();
    expect(queryByTestId("battery-optimization-request-button")).toBeNull();
  });

  it("shows request button when not excluded", async () => {
    mockIgnored = false;
    const { getByText, getByTestId } = await renderScreen();

    expect(getByText("settings.batteryOptimizationEnabled")).toBeTruthy();
    expect(getByTestId("battery-optimization-request-button")).toBeTruthy();
  });

  it("calls requestExclusion on button press", async () => {
    mockIgnored = false;

    const { getByTestId } = await renderScreen();

    const button = getByTestId("battery-optimization-request-button");

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockRequestExclusion).toHaveBeenCalledTimes(1);
  });
});
