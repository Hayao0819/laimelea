import React from "react";
import { render } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { SettingsScreen } from "../../../src/features/settings/screens/SettingsScreen";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

jest.mock("../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

jest.mock("../../../src/core/i18n", () => ({
  __esModule: true,
  default: { language: "en", changeLanguage: jest.fn() },
  resolveLanguage: (setting: string) =>
    setting === "auto" || !["en", "ja"].includes(setting) ? "en" : setting,
  detectSystemLanguage: () => "en",
  SUPPORTED_LANGUAGES: ["ja", "en"],
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

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getTokens: jest.fn(),
    configure: jest.fn(),
  },
}));

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
  return render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <SettingsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
}

describe("SettingsScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-screen")).toBeTruthy();
  });

  it("should display cycle config inputs", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("cycle-hours-input")).toBeTruthy();
    expect(getByTestId("cycle-minutes-input")).toBeTruthy();
  });

  it("should display use current time button", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("use-current-time-button")).toBeTruthy();
  });

  it("should display timezone item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("timezone-item")).toBeTruthy();
  });

  it("should display backup buttons", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("backup-now-button")).toBeTruthy();
    expect(getByTestId("restore-button")).toBeTruthy();
  });

  it("should display alarm defaults section", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("vibration-item")).toBeTruthy();
    expect(getByTestId("gradual-volume-item")).toBeTruthy();
  });
});
