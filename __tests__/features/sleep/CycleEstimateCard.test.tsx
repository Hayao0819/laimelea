import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { cycleEstimationAtom } from "../../../src/atoms/sleepAtoms";
import { CycleEstimateCard } from "../../../src/features/sleep/components/CycleEstimateCard";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { CycleEstimation } from "../../../src/models/SleepSession";

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
    t: (key: string) => {
      const translations: Record<string, string> = {
        "sleep.cycleEstimate": "Cycle Estimate",
        "sleep.notEnoughData": "Need at least 7 days of data",
        "sleep.confidence.low": "Confidence: Low",
        "sleep.confidence.medium": "Confidence: Medium",
        "sleep.confidence.high": "Confidence: High",
        "sleep.period": "Estimated Period",
        "sleep.drift": "Drift per Day",
        "sleep.dataPoints": "Data Points",
        "sleep.applyCycle": "Apply This Cycle",
        "sleep.hours": "h",
        "sleep.minutes": "m",
        "sleep.day": "d",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

function makeEstimation(
  overrides: Partial<CycleEstimation> = {},
): CycleEstimation {
  return {
    periodMinutes: 1560,
    driftMinutesPerDay: 2.3,
    r2: 0.85,
    confidence: "medium",
    dataPointsUsed: 14,
    ...overrides,
  };
}

function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <CycleEstimateCard />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("CycleEstimateCard", () => {
  it("should display not enough data text when estimation is null", async () => {
    const store = createStore();
    store.set(cycleEstimationAtom, null);
    const { getByText, getByTestId } = await renderWithProviders(store);

    expect(getByTestId("cycle-estimate-card-empty")).toBeTruthy();
    expect(getByText("Need at least 7 days of data")).toBeTruthy();
  });

  it("should display estimation data when available", async () => {
    const store = createStore();
    const estimation = makeEstimation();
    store.set(cycleEstimationAtom, estimation);
    const { getByText, getByTestId } = await renderWithProviders(store);

    expect(getByTestId("cycle-estimate-card")).toBeTruthy();
    expect(getByText("Cycle Estimate")).toBeTruthy();
    expect(getByText(/0\.85/)).toBeTruthy();
    expect(getByText(/14/)).toBeTruthy();
  });

  it("should display confidence chip with correct text", async () => {
    const store = createStore();
    store.set(cycleEstimationAtom, makeEstimation({ confidence: "low" }));
    const { getByTestId } = await renderWithProviders(store);

    const chip = getByTestId("confidence-chip");
    expect(chip).toBeTruthy();
    // The chip should contain the low confidence text
    expect(chip).toHaveTextContent("Confidence: Low");
  });

  it("should update settings when Apply button is pressed", async () => {
    const store = createStore();
    const estimation = makeEstimation({ periodMinutes: 1620 });
    store.set(cycleEstimationAtom, estimation);
    const { getByTestId } = await renderWithProviders(store);

    await fireEvent.press(getByTestId("apply-cycle-button"));

    await waitFor(async () => {
      const settings = await store.get(settingsAtom);
      expect(settings.cycleConfig.cycleLengthMinutes).toBe(1620);
    });
  });

  it("should format period as hours and minutes", async () => {
    const store = createStore();
    store.set(cycleEstimationAtom, makeEstimation({ periodMinutes: 1560 }));
    const { getByText } = await renderWithProviders(store);

    // 1560 minutes = 26h 0m
    expect(getByText(/26h/)).toBeTruthy();
  });

  it("should display high confidence chip", async () => {
    const store = createStore();
    store.set(cycleEstimationAtom, makeEstimation({ confidence: "high" }));
    const { getByTestId } = await renderWithProviders(store);

    const chip = getByTestId("confidence-chip");
    expect(chip).toHaveTextContent("Confidence: High");
  });
});
