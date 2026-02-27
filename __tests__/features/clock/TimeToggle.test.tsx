import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { TimeToggle } from "../../../src/features/clock/components/TimeToggle";
import {
  settingsAtom,
  primaryTimeDisplayAtom,
} from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

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

function createInitializedStore(settings = DEFAULT_SETTINGS) {
  const store = createStore();
  store.set(settingsAtom, settings);
  return store;
}

function renderWithProviders(store?: ReturnType<typeof createStore>) {
  const s = store ?? createInitializedStore();
  const utils = render(
    <JotaiProvider store={s}>
      <PaperProvider>
        <TimeToggle />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store: s };
}

describe("TimeToggle", () => {
  it('should render with testID "time-toggle"', async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("time-toggle")).toBeTruthy();
  });

  it("should render segmented buttons with custom and 24h options", async () => {
    const { getByText } = await renderWithProviders();

    // Labels use t() which returns the key
    expect(getByText("clock.customTime")).toBeTruthy();
    expect(getByText("clock.realTime")).toBeTruthy();
  });

  it("should update primaryTimeDisplayAtom on value change", async () => {
    const store = createInitializedStore({
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "custom",
    });

    const { getByText } = await renderWithProviders(store);

    // Verify initial state
    expect(store.get(primaryTimeDisplayAtom)).toBe("custom");

    // Press the "24h" button (labeled "clock.realTime")
    await fireEvent.press(getByText("clock.realTime"));

    // The atom should now be "24h"
    expect(store.get(primaryTimeDisplayAtom)).toBe("24h");
  });

  it("should reflect current atom value", async () => {
    const store = createInitializedStore({
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "24h",
    });

    const { getByText } = await renderWithProviders(store);

    // Both buttons should still be rendered regardless of current value
    expect(getByText("clock.customTime")).toBeTruthy();
    expect(getByText("clock.realTime")).toBeTruthy();

    // Current value should be "24h"
    expect(store.get(primaryTimeDisplayAtom)).toBe("24h");
  });

  it("should toggle back to custom from 24h", async () => {
    const store = createInitializedStore({
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "24h",
    });

    const { getByText } = await renderWithProviders(store);

    expect(store.get(primaryTimeDisplayAtom)).toBe("24h");

    // Press "custom" button
    await fireEvent.press(getByText("clock.customTime"));

    expect(store.get(primaryTimeDisplayAtom)).toBe("custom");
  });
});
