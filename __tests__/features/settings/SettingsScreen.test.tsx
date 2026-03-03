import { render } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { SettingsScreen } from "../../../src/features/settings/screens/SettingsScreen";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const mockNavigate = jest.fn();

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

function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  return {
    store,
    ...render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SettingsScreen (hub)", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-screen")).toBeTruthy();
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
    expect(getByTestId("settings-legal-item")).toBeTruthy();
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
    const { getByText } = await render(
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
    const { getByText } = await render(
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
    const { queryByText } = await render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    );
    expect(queryByText("auto")).toBeNull();
  });
});
