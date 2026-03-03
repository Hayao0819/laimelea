import { fireEvent,render } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
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

function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <DeskClockScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

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
