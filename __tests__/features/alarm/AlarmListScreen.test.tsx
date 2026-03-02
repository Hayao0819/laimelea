import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { AlarmListScreen } from "../../../src/features/alarm/screens/AlarmListScreen";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { Alarm } from "../../../src/models/Alarm";

jest.mock("../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
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

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("alarm"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4 },
  AndroidCategory: { ALARM: "alarm" },
  AuthorizationStatus: { AUTHORIZED: 1 },
  EventType: { PRESS: 1, ACTION_PRESS: 7, DISMISSED: 2 },
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require("react");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
}));

jest.mock("date-fns", () => ({
  format: jest.fn(() => "07:00"),
}));

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Morning",
    enabled: true,
    targetTimestampMs: Date.now() + 3600000,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 15,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

async function renderWithProviders(
  store = createStore(),
  initialAlarms: Alarm[] = [],
) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, initialAlarms);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <AlarmListScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  // Flush pending effects (useFocusEffect, FAB.Group animations)
  await act(async () => {});
  return { ...utils, store };
}

describe("AlarmListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show empty state when no alarms", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("no-alarms-text")).toBeTruthy();
  });

  it("should show FAB group", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("alarm-fab-group")).toBeTruthy();
  });

  it("should render FAB.Group with new alarm and bulk create actions", async () => {
    const { getByTestId } = await renderWithProviders();
    // FAB.Group action FABs are accessibility-hidden by react-native-paper design
    expect(
      getByTestId("add-alarm-fab", { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      getByTestId("bulk-create-fab", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("should display alarm card when alarms exist", async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);

    expect(getByTestId("alarm-card-test-alarm-1")).toBeTruthy();
  });

  it("should navigate to AlarmEdit on alarm card press", async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);

    await act(async () => {
      fireEvent.press(getByTestId("alarm-card-test-alarm-1"));
    });
    expect(mockNavigate).toHaveBeenCalledWith("AlarmEdit", {
      alarmId: "test-alarm-1",
    });
  });
});
