import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { SleepLogScreen } from "../../../src/features/sleep/screens/SleepLogScreen";
import { sleepSessionsAtom, cycleEstimationAtom } from "../../../src/atoms/sleepAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { SleepSession } from "../../../src/models/SleepSession";

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
        "sleep.noData": "No sleep data",
        "sleep.sleepStart": "Sleep Start",
        "sleep.sleepEnd": "Wake Up",
        "sleep.duration": "Duration",
        "sleep.sourceManual": "Manual",
        "sleep.sourceHealthConnect": "Health Connect",
        "sleep.deleteConfirm": "Delete this sleep entry?",
        "sleep.cycleEstimate": "Cycle Estimate",
        "sleep.notEnoughData": "Need at least 7 days of data",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

// Mock SleepDriftChart to avoid SVG rendering complexity
jest.mock(
  "../../../src/features/sleep/components/SleepDriftChart",
  () => ({
    SleepDriftChart: () => null,
  }),
);

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

function makeSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: "session-1",
    source: "manual",
    startTimestampMs: new Date("2026-02-25T23:00:00").getTime(),
    endTimestampMs: new Date("2026-02-26T07:00:00").getTime(),
    stages: [],
    durationMs: 8 * 60 * 60 * 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <SleepLogScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("SleepLogScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display empty state when there are no sessions", async () => {
    const store = createStore();
    store.set(sleepSessionsAtom, []);
    const { getByText } = await renderWithProviders(store);

    expect(getByText("No sleep data")).toBeTruthy();
  });

  it("should display session list with date, time, and duration", async () => {
    const store = createStore();
    const session = makeSession();
    store.set(sleepSessionsAtom, [session]);
    const { getByText } = await renderWithProviders(store);

    expect(getByText("2026-02-25")).toBeTruthy();
    expect(getByText("23:00")).toBeTruthy();
    expect(getByText("07:00")).toBeTruthy();
    expect(getByText("8h 0m")).toBeTruthy();
  });

  it("should display source label for manual and health_connect sessions", async () => {
    const store = createStore();
    const manualSession = makeSession({ id: "s1", source: "manual" });
    const hcSession = makeSession({
      id: "s2",
      source: "health_connect",
      startTimestampMs: new Date("2026-02-24T22:00:00").getTime(),
      endTimestampMs: new Date("2026-02-25T06:00:00").getTime(),
    });
    store.set(sleepSessionsAtom, [manualSession, hcSession]);
    const { getByText } = await renderWithProviders(store);

    expect(getByText("Manual")).toBeTruthy();
    expect(getByText("Health Connect")).toBeTruthy();
  });

  it("should navigate to ManualSleepEntry when FAB is pressed", async () => {
    const store = createStore();
    store.set(sleepSessionsAtom, []);
    const { getByTestId } = await renderWithProviders(store);

    await fireEvent.press(getByTestId("add-sleep-fab"));

    expect(mockNavigate).toHaveBeenCalledWith("ManualSleepEntry", {});
  });

  it("should sort sessions in descending order by start time", async () => {
    const store = createStore();
    const olderSession = makeSession({
      id: "s-old",
      startTimestampMs: new Date("2026-02-20T23:00:00").getTime(),
      endTimestampMs: new Date("2026-02-21T07:00:00").getTime(),
    });
    const newerSession = makeSession({
      id: "s-new",
      startTimestampMs: new Date("2026-02-26T23:00:00").getTime(),
      endTimestampMs: new Date("2026-02-27T07:00:00").getTime(),
    });
    store.set(sleepSessionsAtom, [olderSession, newerSession]);
    const { getAllByText } = await renderWithProviders(store);

    // Both dates should be visible; the newer date should appear first
    const dateTexts = getAllByText(/2026-02-/);
    expect(dateTexts.length).toBeGreaterThanOrEqual(2);
    // First rendered date should be the newer session
    expect(dateTexts[0]).toHaveTextContent("2026-02-26");
    expect(dateTexts[1]).toHaveTextContent("2026-02-20");
  });

  it("should display CycleEstimateCard in header", async () => {
    const store = createStore();
    store.set(sleepSessionsAtom, []);
    store.set(cycleEstimationAtom, null);
    const { getByTestId } = await renderWithProviders(store);

    // CycleEstimateCard renders with testID "cycle-estimate-card-empty" when no estimation
    expect(getByTestId("cycle-estimate-card-empty")).toBeTruthy();
  });

  it("should render the screen with testID", async () => {
    const store = createStore();
    store.set(sleepSessionsAtom, []);
    const { getByTestId } = await renderWithProviders(store);

    expect(getByTestId("sleep-log-screen")).toBeTruthy();
    expect(getByTestId("sleep-session-list")).toBeTruthy();
  });
});
