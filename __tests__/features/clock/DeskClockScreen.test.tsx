import { act, fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { currentTimeMsAtom } from "../../../src/atoms/clockAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import {
  DeskClockScreen,
  getDeskClockPrimaryFontSize,
} from "../../../src/features/clock/screens/DeskClockScreen";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const mockGoBack = jest.fn();
const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, right: 12, bottom: 34, left: 0 },
};
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
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
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../src/hooks/useFullscreen", () => ({
  useFullscreen: jest.fn(),
}));

async function renderWithProviders(
  store = createStore(),
  settings = DEFAULT_SETTINGS,
) {
  store.set(settingsAtom, settings);
  const utils = await render(
    <JotaiProvider store={store}>
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PaperProvider>
          <DeskClockScreen />
        </PaperProvider>
      </SafeAreaProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

const originalConsoleError = console.error;

beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("suspended inside an `act` scope")) return;
    if (msg.includes("suspended resource finished loading")) return;
    originalConsoleError(...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe("DeskClockScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
  });

  it("should render desk clock screen", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("desk-clock-screen")).toBeTruthy();
  });

  it("should display time with timer role", async () => {
    const { getByRole } = await renderWithProviders();
    expect(getByRole("timer")).toBeTruthy();
  });

  it("uses landscape sizing when the window is wider than it is tall", () => {
    expect(getDeskClockPrimaryFontSize(844, 390)).toBe(126.6);
  });

  it("uses the configured timezone for real time", async () => {
    const store = createStore();
    store.set(currentTimeMsAtom, 0);
    const settings = {
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "24h" as const,
      timezone: "Asia/Tokyo",
    };

    const { getByRole } = await renderWithProviders(store, settings);

    expect(getByRole("timer").props.accessibilityLabel).toBe("09:00:00");
  });

  it("should navigate back when close button is pressed", async () => {
    const { getByTestId } = await renderWithProviders();
    await fireEvent.press(getByTestId("desk-clock-close"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("positions the close button below cutouts and transient bars", async () => {
    const { getByTestId } = await renderWithProviders();

    expect(
      StyleSheet.flatten(getByTestId("desk-clock-close-target").props.style),
    ).toMatchObject({ top: 32, right: 20 });
  });
});
