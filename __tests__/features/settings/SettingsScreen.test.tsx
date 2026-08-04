import { act, fireEvent, renderAsync } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { spacing } from "../../../src/app/spacing";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { SettingsScreen } from "../../../src/features/settings/screens/SettingsScreen";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const mockNavigate = jest.fn();
const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, right: 16, bottom: 24, left: 12 },
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

async function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = await renderAsync(
    <JotaiProvider store={store}>
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </SafeAreaProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SettingsScreen (hub)", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-screen")).toBeTruthy();
  });

  it("adds the bottom safe-area inset to the scroll padding", async () => {
    const { getByTestId } = await renderWithProviders();

    expect(getByTestId("settings-scroll").props.contentContainerStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paddingBottom: spacing.xl + 24,
          paddingLeft: 12,
          paddingRight: 16,
        }),
      ]),
    );
  });

  it("should display category headers", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("settings.categoryApp")).toBeTruthy();
    expect(getByText("settings.categoryFeatures")).toBeTruthy();
    expect(getByText("settings.categoryInfo")).toBeTruthy();
  });

  it("should display all menu items", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-cycle-config-item")).toBeTruthy();
    expect(getByTestId("settings-general-item")).toBeTruthy();
    expect(getByTestId("settings-timezone-item")).toBeTruthy();
    expect(getByTestId("settings-alarm-defaults-item")).toBeTruthy();
    expect(getByTestId("settings-calendar-item")).toBeTruthy();
    expect(getByTestId("settings-widget-item")).toBeTruthy();
    expect(getByTestId("settings-backup-item")).toBeTruthy();
    expect(getByTestId("settings-about-item")).toBeTruthy();
  });

  it("should show cycle config description with hours and minutes", async () => {
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      cycleConfig: {
        ...DEFAULT_SETTINGS.cycleConfig,
        cycleLengthMinutes: 26 * 60,
      },
    });
    const { getByText } = await renderAsync(
      <JotaiProvider store={store}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    );
    expect(getByText("26h 0m")).toBeTruthy();
  });

  it("should show timezone description when not auto", async () => {
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      timezone: "America/New_York",
    });
    const { getByText } = await renderAsync(
      <JotaiProvider store={store}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    );
    expect(getByText("America/New_York")).toBeTruthy();
  });

  it("should not show timezone description when auto", async () => {
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      timezone: "auto",
    });
    const { queryByText } = await renderAsync(
      <JotaiProvider store={store}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    );
    expect(queryByText("auto")).toBeNull();
  });

  it("should navigate to SettingsCycleConfig on cycle config press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-cycle-config-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsCycleConfig");
  });

  it("should navigate to SettingsGeneral on general press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-general-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsGeneral");
  });

  it("should navigate to SettingsTimezone on timezone press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-timezone-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsTimezone");
  });

  it("should navigate to SettingsAlarmDefaults on alarm defaults press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-alarm-defaults-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsAlarmDefaults");
  });

  it("should navigate to SettingsCalendar on calendar press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-calendar-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsCalendar");
  });

  it("should navigate to SettingsWidget on widget press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-widget-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsWidget");
  });

  it("should navigate to SettingsBackup on backup press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-backup-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsBackup");
  });

  it("should navigate to SettingsAbout on about press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-about-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsAbout");
  });

  it("should display legal menu item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-legal-item")).toBeTruthy();
  });

  it("should navigate to SettingsLegal on legal press", async () => {
    const { getByTestId } = await renderWithProviders();
    const item = getByTestId("settings-legal-item");
    await act(async () => {
      fireEvent.press(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith("SettingsLegal");
  });
});
