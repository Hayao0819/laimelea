import { act, fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DeskClockScreen } from "../../../src/features/clock/screens/DeskClockScreen";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const mockGoBack = jest.fn();
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

async function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <DeskClockScreen />
      </PaperProvider>
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
    jest.useFakeTimers();
    mockGoBack.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should render desk clock screen", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("desk-clock-screen")).toBeTruthy();
  });

  it("should display time with timer role", async () => {
    const { getByRole } = await renderWithProviders();
    expect(getByRole("timer")).toBeTruthy();
  });

  it("should navigate back when close button is pressed", async () => {
    const { getByTestId } = await renderWithProviders();
    await fireEvent.press(getByTestId("desk-clock-close"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
