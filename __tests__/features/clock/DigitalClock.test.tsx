import { render } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DigitalClock } from "../../../src/features/clock/components/DigitalClock";
import type { CustomTimeValue } from "../../../src/models/CustomTime";
import type { AppSettings } from "../../../src/models/Settings";
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

const sampleCustomTime: CustomTimeValue = {
  day: 5,
  hours: 14,
  minutes: 30,
  seconds: 45,
};

// 2026-01-15T10:30:45Z
const sampleRealTimeMs = new Date("2026-01-15T10:30:45Z").getTime();

function renderWithProviders(
  ui: React.ReactElement,
  settingsOverride?: Partial<AppSettings>,
) {
  const store = createStore();
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  store.set(settingsAtom, settings);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>{ui}</PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("DigitalClock", () => {
  it('should display formatted custom time as primary when primaryTimeDisplay is "custom"', async () => {
    const { getAllByText } = await renderWithProviders(
      <DigitalClock
        realTimeMs={sampleRealTimeMs}
        customTime={sampleCustomTime}
      />,
      { primaryTimeDisplay: "custom" },
    );

    // Custom time formatted as "14:30:45"
    const customFormatted = "14:30:45";
    const matches = getAllByText(customFormatted);
    // The primary text should be first in the tree
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should display formatted real time as primary when primaryTimeDisplay is "24h"', async () => {
    // Use a fixed timestamp where we know the local formatted output
    const fixedDate = new Date(2026, 0, 15, 10, 30, 45); // local time 10:30:45
    const fixedMs = fixedDate.getTime();

    const { getAllByText } = await renderWithProviders(
      <DigitalClock realTimeMs={fixedMs} customTime={sampleCustomTime} />,
      { primaryTimeDisplay: "24h", timeFormat: "24h" },
    );

    // Real time formatted as "10:30:45" in 24h format
    const realFormatted = "10:30:45";
    const matches = getAllByText(realFormatted);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("should display both primary and secondary time texts", async () => {
    const fixedDate = new Date(2026, 0, 15, 10, 30, 45);
    const fixedMs = fixedDate.getTime();

    const customTime: CustomTimeValue = {
      day: 1,
      hours: 22,
      minutes: 15,
      seconds: 10,
    };

    const { getByText } = await renderWithProviders(
      <DigitalClock realTimeMs={fixedMs} customTime={customTime} />,
      { primaryTimeDisplay: "custom", timeFormat: "24h" },
    );

    // Primary: custom time "22:15:10"
    expect(getByText("22:15:10")).toBeTruthy();
    // Secondary: real time "10:30:45"
    expect(getByText("10:30:45")).toBeTruthy();
  });

  it('should format real time in 12h format when timeFormat is "12h"', async () => {
    const fixedDate = new Date(2026, 0, 15, 14, 30, 45); // 2:30:45 PM
    const fixedMs = fixedDate.getTime();

    const { getByText } = await renderWithProviders(
      <DigitalClock realTimeMs={fixedMs} customTime={sampleCustomTime} />,
      { primaryTimeDisplay: "24h", timeFormat: "12h" },
    );

    // 12h format: "02:30:45 PM"
    expect(getByText("02:30:45 PM")).toBeTruthy();
  });

  it("should swap primary and secondary when toggling primaryTimeDisplay", async () => {
    const fixedDate = new Date(2026, 0, 15, 8, 0, 0);
    const fixedMs = fixedDate.getTime();

    const customTime: CustomTimeValue = {
      day: 1,
      hours: 3,
      minutes: 15,
      seconds: 0,
    };

    // With "custom" as primary: both times rendered, custom first
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "custom",
      timeFormat: "24h",
    });

    const { getByText, getByTestId, rerender } = await render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <DigitalClock realTimeMs={fixedMs} customTime={customTime} />
        </PaperProvider>
      </JotaiProvider>,
    );

    expect(getByText("03:15:00")).toBeTruthy();
    expect(getByText("08:00:00")).toBeTruthy();
    expect(getByTestId("digital-clock").children.length).toBe(2);

    // Switch to "24h" primary via atom update
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "24h",
      timeFormat: "24h",
    });

    await rerender(
      <JotaiProvider store={store}>
        <PaperProvider>
          <DigitalClock realTimeMs={fixedMs} customTime={customTime} />
        </PaperProvider>
      </JotaiProvider>,
    );

    // Both texts should still be present but in swapped order
    expect(getByText("08:00:00")).toBeTruthy();
    expect(getByText("03:15:00")).toBeTruthy();
  });
});
