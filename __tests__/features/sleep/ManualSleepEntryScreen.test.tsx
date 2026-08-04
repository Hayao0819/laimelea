import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { sleepSessionsAtom } from "../../../src/atoms/sleepAtoms";
import { ManualSleepEntryScreen } from "../../../src/features/sleep/screens/ManualSleepEntryScreen";
import type { SleepSession } from "../../../src/models/SleepSession";

// Replace atomWithStorage with plain atom to avoid async initialization issues
jest.mock("../../../src/atoms/sleepAtoms", () => {
  const { atom } = require("jotai");
  return {
    sleepSessionsAtom: atom([] as SleepSession[]),
    sleepLoadingAtom: atom(false),
    sleepErrorAtom: atom(null as string | null),
    sleepLastSyncAtom: atom(null as number | null),
    cycleEstimationAtom: atom(null),
    sleepCacheStaleAtom: atom(true),
    SLEEP_CACHE_TTL_MS: 600000,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "sleep.manualEntry": "Manual Entry",
        "sleep.sleepStart": "Sleep Start",
        "sleep.sleepEnd": "Wake Up",
        "sleep.date": "Date",
        "sleep.time": "Time",
        "sleep.validationError": "Wake time must be after sleep time",
        "sleep.saved": "Sleep entry saved",
        "common.save": "Save",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
const mockRouteParams: { sessionId?: string } = {};
const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, right: 0, bottom: 24, left: 0 },
};

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

function makeSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: "existing-session",
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

function renderWithProviders(
  store = createStore(),
  initialSessions: SleepSession[] = [],
) {
  store.set(sleepSessionsAtom, initialSessions);
  const utils = render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <JotaiProvider store={store}>
        <PaperProvider>
          <ManualSleepEntryScreen />
        </PaperProvider>
      </JotaiProvider>
    </SafeAreaProvider>,
  );
  return { ...utils, store };
}

describe("ManualSleepEntryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams.sessionId = undefined;
  });

  it("should display four text inputs for date and time", async () => {
    const { getByTestId } = await renderWithProviders();

    expect(getByTestId("start-date-input")).toBeTruthy();
    expect(getByTestId("start-time-input")).toBeTruthy();
    expect(getByTestId("end-date-input")).toBeTruthy();
    expect(getByTestId("end-time-input")).toBeTruthy();
  });

  it("adds the bottom safe-area inset to scroll content", async () => {
    const { getByTestId } = await renderWithProviders();

    expect(
      StyleSheet.flatten(
        getByTestId("manual-sleep-entry-scroll").props.contentContainerStyle,
      ).paddingBottom,
    ).toBe(40);
  });

  it("should save a new session and call goBack on valid input", async () => {
    const store = createStore();
    store.set(sleepSessionsAtom, []);
    const { getByTestId } = await renderWithProviders(store);

    await fireEvent.changeText(getByTestId("start-date-input"), "2026-02-25");
    await fireEvent.changeText(getByTestId("start-time-input"), "23:00");
    await fireEvent.changeText(getByTestId("end-date-input"), "2026-02-26");
    await fireEvent.changeText(getByTestId("end-time-input"), "07:00");

    await fireEvent.press(getByTestId("save-button"));

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });

    const sessions = store.get(sleepSessionsAtom) as SleepSession[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0].source).toBe("manual");
    expect(sessions[0].stages).toEqual([]);
    expect(sessions[0].durationMs).toBe(8 * 60 * 60 * 1000);
  });

  it("should show error when end time is before start time", async () => {
    const { getByTestId } = await renderWithProviders();

    await fireEvent.changeText(getByTestId("start-date-input"), "2026-02-26");
    await fireEvent.changeText(getByTestId("start-time-input"), "08:00");
    await fireEvent.changeText(getByTestId("end-date-input"), "2026-02-26");
    await fireEvent.changeText(getByTestId("end-time-input"), "07:00");

    await fireEvent.press(getByTestId("save-button"));

    await waitFor(() => {
      expect(getByTestId("manual-entry-snackbar")).toBeTruthy();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("should populate form with existing session data in edit mode", async () => {
    const existingSession = makeSession({
      startTimestampMs: new Date("2026-02-20T22:30:00").getTime(),
      endTimestampMs: new Date("2026-02-21T06:30:00").getTime(),
    });
    mockRouteParams.sessionId = "existing-session";

    const { getByTestId } = await renderWithProviders(createStore(), [
      existingSession,
    ]);

    expect(getByTestId("start-date-input").props.value).toBe("2026-02-20");
    expect(getByTestId("start-time-input").props.value).toBe("22:30");
    expect(getByTestId("end-date-input").props.value).toBe("2026-02-21");
    expect(getByTestId("end-time-input").props.value).toBe("06:30");
  });

  it("should update an existing session on save", async () => {
    const existingSession = makeSession();
    mockRouteParams.sessionId = existingSession.id;
    const store = createStore();
    const { getByTestId } = await renderWithProviders(store, [existingSession]);

    await fireEvent.changeText(getByTestId("start-time-input"), "22:30");
    await fireEvent.press(getByTestId("save-button"));

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });

    const sessions = store.get(sleepSessionsAtom) as SleepSession[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: existingSession.id,
      startTimestampMs: new Date("2026-02-25T22:30:00").getTime(),
      endTimestampMs: existingSession.endTimestampMs,
      durationMs: 8.5 * 60 * 60 * 1000,
    });
    expect(sessions[0].updatedAt).toBeGreaterThanOrEqual(
      existingSession.updatedAt,
    );
  });

  it("should create session with correct properties on save", async () => {
    const store = createStore();
    store.set(sleepSessionsAtom, []);
    const { getByTestId } = await renderWithProviders(store);

    await fireEvent.changeText(getByTestId("start-date-input"), "2026-02-25");
    await fireEvent.changeText(getByTestId("start-time-input"), "22:00");
    await fireEvent.changeText(getByTestId("end-date-input"), "2026-02-26");
    await fireEvent.changeText(getByTestId("end-time-input"), "06:00");

    await fireEvent.press(getByTestId("save-button"));

    await waitFor(() => {
      const sessions = store.get(sleepSessionsAtom) as SleepSession[];
      expect(sessions).toHaveLength(1);
      const session = sessions[0];
      expect(session.source).toBe("manual");
      expect(session.stages).toEqual([]);
      expect(session.durationMs).toBe(8 * 60 * 60 * 1000);
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });
  });

  it("should render the screen with testID", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("manual-sleep-entry-screen")).toBeTruthy();
  });

  it("should show error for invalid date format", async () => {
    const { getByTestId } = await renderWithProviders();

    await fireEvent.changeText(getByTestId("start-date-input"), "invalid");
    await fireEvent.changeText(getByTestId("start-time-input"), "23:00");
    await fireEvent.changeText(getByTestId("end-date-input"), "2026-02-26");
    await fireEvent.changeText(getByTestId("end-time-input"), "07:00");

    await fireEvent.press(getByTestId("save-button"));

    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
