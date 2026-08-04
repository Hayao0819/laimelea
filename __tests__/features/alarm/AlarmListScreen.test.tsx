import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { Alert } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { AlarmListScreen } from "../../../src/features/alarm/screens/AlarmListScreen";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../../../src/features/alarm/services/alarmScheduler";
import type { Alarm } from "../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, right: 20, bottom: 34, left: 12 },
};

jest.mock("../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

jest.mock("../../../src/features/alarm/services/alarmScheduler", () => ({
  scheduleAlarm: jest.fn().mockResolvedValue("trigger-id"),
  cancelAlarm: jest.fn().mockResolvedValue(undefined),
  recoverAlarmSchedule: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => {
    const store = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        store.has(key) ? store.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
  },
}));

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
const mockCancelAlarm = cancelAlarm as jest.MockedFunction<typeof cancelAlarm>;
const mockRecoverAlarmSchedule = recoverAlarmSchedule as jest.MockedFunction<
  typeof recoverAlarmSchedule
>;
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
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
  const utils = await render(
    <JotaiProvider store={store}>
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PaperProvider>
          <AlarmListScreen />
        </PaperProvider>
      </SafeAreaProvider>
    </JotaiProvider>,
  );
  // Flush pending async atom resolutions and FAB.Group animations
  await act(async () => {});
  await act(async () => {});
  return { ...utils, store };
}

describe("AlarmListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoverAlarmSchedule.mockImplementation(async (alarm) => ({
      ...alarm,
      notifeeTriggerId: "recovered-trigger-id",
    }));
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

  it("does not show a pending test alarm in the list", async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(
      createStore(),
      [makeAlarm({ isTest: true })],
    );

    expect(getByTestId("no-alarms-text")).toBeTruthy();
    expect(queryByTestId("alarm-card-test-alarm-1")).toBeNull();
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

  it("calculates a future timestamp before re-enabling a repeating alarm", async () => {
    const now = Date.now();
    const alarm = makeAlarm({
      enabled: false,
      targetTimestampMs: now - 60 * 60 * 1000,
      repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
    });
    const { getByTestId, store } = await renderWithProviders(createStore(), [
      alarm,
    ]);

    await act(async () => {
      fireEvent(getByTestId("alarm-switch-test-alarm-1"), "valueChange", true);
    });

    expect(scheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: alarm.id,
        targetTimestampMs: expect.any(Number),
      }),
    );
    const storedAlarms = await store.get(alarmsAtom);
    expect(storedAlarms[0].targetTimestampMs).toBeGreaterThan(now);
  });

  it("skips one occurrence from the repeating alarm card", async () => {
    const now = Date.now();
    const alarm = makeAlarm({
      targetTimestampMs: now - 10 * 60 * 1000,
      repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
    });
    const { getByTestId, store } = await renderWithProviders(createStore(), [
      alarm,
    ]);

    await act(async () => {
      fireEvent.press(getByTestId("alarm-skip-next-test-alarm-1"));
    });

    const storedAlarms = await store.get(alarmsAtom);
    expect(scheduleAlarm).toHaveBeenCalledTimes(1);
    expect(storedAlarms[0].targetTimestampMs).toBeGreaterThan(
      now + 50 * 60 * 1000,
    );
    expect(storedAlarms[0].skipNextOccurrence).toBe(false);
  });

  it("recovers the schedule when disabling cannot fully cancel it", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger-id" });
    mockCancelAlarm.mockRejectedValueOnce(new Error("cancel failed"));
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByTestId, store } = await renderWithProviders(createStore(), [
      alarm,
    ]);

    await act(async () => {
      fireEvent(getByTestId("alarm-switch-test-alarm-1"), "valueChange", false);
    });

    await waitFor(async () => {
      const storedAlarms = await store.get(alarmsAtom);
      expect(storedAlarms[0].notifeeTriggerId).toBe("recovered-trigger-id");
    });
    expect(mockRecoverAlarmSchedule).toHaveBeenCalledWith(alarm);
    expect(alertSpy).toHaveBeenCalledWith(
      "alarm.saveAlarm",
      "alarm.scheduleFailed",
    );
    alertSpy.mockRestore();
  });
});
