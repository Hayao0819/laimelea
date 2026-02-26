import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { AlarmListScreen } from "../../../src/features/alarm/screens/AlarmListScreen";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { Alarm } from "../../../src/models/Alarm";

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
    const React = require("react");
    React.useEffect(() => {
      const cleanup = cb();
      return cleanup;
    }, []);
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
    linkedEventOffset: 0,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function renderWithProviders(
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

  it("should show FAB button", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("add-alarm-fab")).toBeTruthy();
  });

  it("should navigate to AlarmEdit on FAB press", async () => {
    const { getByTestId } = await renderWithProviders();
    await act(async () => {
      fireEvent.press(getByTestId("add-alarm-fab"));
    });
    expect(mockNavigate).toHaveBeenCalledWith("AlarmEdit", {});
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
