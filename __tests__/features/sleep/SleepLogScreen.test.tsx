import { fireEvent,render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { SleepLogScreen } from "../../../src/features/sleep/screens/SleepLogScreen";
import type { SleepSyncResult } from "../../../src/hooks/useSleepSync";
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

const mockSync = jest.fn().mockResolvedValue(undefined);
const mockDeleteEntry = jest.fn();
const mockRecalculate = jest.fn();
const mockAddManualEntry = jest.fn();

const defaultSyncResult: SleepSyncResult = {
  sessions: [],
  estimation: null,
  loading: false,
  error: null,
  sync: mockSync,
  recalculate: mockRecalculate,
  addManualEntry: mockAddManualEntry,
  deleteEntry: mockDeleteEntry,
};

let mockSyncResult = { ...defaultSyncResult };

jest.mock("../../../src/hooks/useSleepSync", () => ({
  useSleepSync: () => mockSyncResult,
}));

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
        "sleep.syncError": "Failed to sync sleep data",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

// Mock SleepDriftChart to avoid SVG rendering complexity
jest.mock("../../../src/features/sleep/components/SleepDriftChart", () => ({
  SleepDriftChart: () => null,
}));

// Mock CycleEstimateCard since it depends on atoms we're not providing
jest.mock("../../../src/features/sleep/components/CycleEstimateCard", () => ({
  CycleEstimateCard: () => null,
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require("react");
    useEffect(cb, [cb]);
  },
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

function renderScreen() {
  return render(
    <PaperProvider>
      <SleepLogScreen />
    </PaperProvider>,
  );
}

describe("SleepLogScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncResult = { ...defaultSyncResult };
  });

  it("should display empty state when there are no sessions", async () => {
    const { getByText } = await renderScreen();
    expect(getByText("No sleep data")).toBeTruthy();
  });

  it("should display session list with date, time, and duration", async () => {
    const session = makeSession();
    mockSyncResult = { ...defaultSyncResult, sessions: [session] };
    const { getByText } = await renderScreen();

    expect(getByText("2026-02-25")).toBeTruthy();
    expect(getByText("23:00")).toBeTruthy();
    expect(getByText("07:00")).toBeTruthy();
    expect(getByText("8h 0m")).toBeTruthy();
  });

  it("should display source label for manual and health_connect sessions", async () => {
    const manualSession = makeSession({ id: "s1", source: "manual" });
    const hcSession = makeSession({
      id: "s2",
      source: "health_connect",
      startTimestampMs: new Date("2026-02-24T22:00:00").getTime(),
      endTimestampMs: new Date("2026-02-25T06:00:00").getTime(),
    });
    mockSyncResult = {
      ...defaultSyncResult,
      sessions: [manualSession, hcSession],
    };
    const { getByText } = await renderScreen();

    expect(getByText("Manual")).toBeTruthy();
    expect(getByText("Health Connect")).toBeTruthy();
  });

  it("should navigate to ManualSleepEntry when FAB is pressed", async () => {
    const { getByTestId } = await renderScreen();

    await fireEvent.press(getByTestId("add-sleep-fab"));

    expect(mockNavigate).toHaveBeenCalledWith("ManualSleepEntry", {});
  });

  it("should sort sessions in descending order by start time", async () => {
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
    mockSyncResult = {
      ...defaultSyncResult,
      sessions: [olderSession, newerSession],
    };
    const { getAllByText } = await renderScreen();

    const dateTexts = getAllByText(/2026-02-/);
    expect(dateTexts.length).toBeGreaterThanOrEqual(2);
    expect(dateTexts[0]).toHaveTextContent("2026-02-26");
    expect(dateTexts[1]).toHaveTextContent("2026-02-20");
  });

  it("should render the screen with testID", async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId("sleep-log-screen")).toBeTruthy();
    expect(getByTestId("sleep-session-list")).toBeTruthy();
  });

  it("should call sync on focus", async () => {
    await renderScreen();
    expect(mockSync).toHaveBeenCalled();
  });

  it("should call sync(true) on pull-to-refresh", async () => {
    const { getByTestId } = await renderScreen();
    const list = getByTestId("sleep-session-list");

    const refreshControl = list.props.refreshControl;
    expect(refreshControl).toBeTruthy();

    await refreshControl.props.onRefresh();
    expect(mockSync).toHaveBeenCalledWith(true);
  });

  it("should call deleteEntry when confirming delete", async () => {
    const session = makeSession({ id: "delete-me", source: "manual" });
    mockSyncResult = { ...defaultSyncResult, sessions: [session] };
    const { getByText, getByTestId } = await renderScreen();

    // Long press to trigger delete dialog
    await fireEvent(getByText("2026-02-25"), "onLongPress");

    // Confirm deletion
    await fireEvent.press(getByTestId("confirm-delete-button"));

    expect(mockDeleteEntry).toHaveBeenCalledWith("delete-me");
  });

  it("should show error snackbar when sync error occurs", async () => {
    mockSyncResult = {
      ...defaultSyncResult,
      error: "Network error",
    };
    const { getByText } = await renderScreen();

    expect(getByText("Failed to sync sleep data")).toBeTruthy();
  });

  it("should show loading state in refresh control", async () => {
    mockSyncResult = { ...defaultSyncResult, loading: true };
    const { getByTestId } = await renderScreen();

    const list = getByTestId("sleep-session-list");
    expect(list.props.refreshControl.props.refreshing).toBe(true);
  });
});
