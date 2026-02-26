import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";

import { SetupScreen } from "../../../src/features/setup/screens/SetupScreen";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import type { AppSettings } from "../../../src/models/Settings";

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

function renderWithProviders(store = createStore()) {
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <SetupScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("SetupScreen", () => {
  it("should display welcome text", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("setup.welcome")).toBeTruthy();
    expect(getByText("setup.description")).toBeTruthy();
  });

  it("should have done button disabled initially", async () => {
    const { getByTestId } = await renderWithProviders();
    const doneButton = getByTestId("done-button");
    expect(doneButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("should enable done button after setting base time", async () => {
    const { getByText, getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByText("setup.useNow"));
    });

    await waitFor(() => {
      const doneButton = getByTestId("done-button");
      expect(doneButton.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it("should set setupComplete to true on done", async () => {
    const store = createStore();
    const { getByText, getByTestId } = await renderWithProviders(store);

    await act(async () => {
      fireEvent.press(getByText("setup.useNow"));
    });

    await act(async () => {
      fireEvent.press(getByTestId("done-button"));
    });

    const settings = store.get(settingsAtom) as AppSettings;
    expect(settings.setupComplete).toBe(true);
    expect(settings.cycleConfig.cycleLengthMinutes).toBe(1560); // 26h default
    expect(settings.cycleConfig.baseTimeMs).toBeGreaterThan(0);
  });

  it("should show preview after setting base time", async () => {
    const { getByText } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByText("setup.useNow"));
    });

    await waitFor(() => {
      expect(getByText("setup.preview")).toBeTruthy();
    });
  });
});
