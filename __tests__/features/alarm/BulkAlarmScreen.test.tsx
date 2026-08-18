import notifee from "@notifee/react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { Alert, StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { BulkAlarmScreen } from "../../../src/features/alarm/screens/BulkAlarmScreen";
import {
  cancelAlarm,
  scheduleAlarm,
} from "../../../src/features/alarm/services/alarmScheduler";
import type { Alarm } from "../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

jest.mock("react-native-shake", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

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
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("alarm"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
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

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
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
}));

jest.mock("../../../src/features/alarm/services/alarmScheduler", () => ({
  scheduleAlarm: jest.fn().mockResolvedValue("trigger-id"),
  cancelAlarm: jest.fn().mockResolvedValue(undefined),
}));

function makeAlarm(index: number, enabled = true): Alarm {
  const now = Date.now();
  return {
    id: `existing-${index}`,
    label: "Existing",
    enabled,
    targetTimestampMs: now + 60 * 60 * 1000,
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
    notifeeTriggerId: `trigger-existing-${index}`,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function renderWithProviders(
  store = createStore(),
  initialAlarms: Alarm[] = [],
) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, initialAlarms);
  const utils = await render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <JotaiProvider store={store}>
        <PaperProvider>
          <BulkAlarmScreen />
        </PaperProvider>
      </JotaiProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

describe("BulkAlarmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue([]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-27T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render with testID "bulk-alarm-screen"', async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("bulk-alarm-screen")).toBeTruthy();
  });

  it("adds the bottom safe-area inset to scroll content", async () => {
    const { getByTestId } = await renderWithProviders();

    expect(
      StyleSheet.flatten(
        getByTestId("bulk-alarm-scroll").props.contentContainerStyle,
      ).paddingBottom,
    ).toBe(40);
  });

  it("should render BulkAlarmForm", async () => {
    const { getByTestId } = await renderWithProviders();
    // BulkAlarmForm renders interval-input, bulk-label-input, etc.
    expect(getByTestId("interval-input")).toBeTruthy();
    expect(getByTestId("bulk-label-input")).toBeTruthy();
    expect(getByTestId("bulk-dismissal-item")).toBeTruthy();
  });

  it("should set navigation title via setOptions", async () => {
    await renderWithProviders();

    expect(mockSetOptions).toHaveBeenCalled();
    const options = mockSetOptions.mock.calls[0][0];
    expect(options.title).toBe("alarm.bulkCreate");
  });

  it("should render save button in header", async () => {
    await renderWithProviders();

    expect(mockSetOptions).toHaveBeenCalled();
    const options = mockSetOptions.mock.calls[0][0];
    expect(options.headerRight).toBeDefined();
    expect(typeof options.headerRight).toBe("function");

    // Verify the SaveButton renders with the expected testID by calling it directly
    const SaveButton = options.headerRight;
    const element = SaveButton();
    expect(element).toBeTruthy();
    expect(element.props.testID).toBe("bulk-save-button");
  });

  it("should disable save when no preview alarms", async () => {
    // Default interval is "30" and from=07:00, to=09:00 which generates alarms.
    // Set interval to "0" so no alarms are generated.
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    store.set(alarmsAtom, []);

    const { getByTestId } = render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <BulkAlarmScreen />
        </PaperProvider>
      </JotaiProvider>,
    );
    await act(async () => {});

    // Change interval to 0 to produce no preview alarms
    await act(async () => {
      fireEvent.changeText(getByTestId("interval-input"), "0");
    });

    // Get the latest setOptions call to extract SaveButton
    const lastCall =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    const SaveButton = lastCall.headerRight;
    const { getByTestId: getSaveById } = render(
      <PaperProvider>
        <SaveButton />
      </PaperProvider>,
    );

    const saveButton = getSaveById("bulk-save-button");
    expect(saveButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("should save alarms and navigate back on save button press", async () => {
    const store = createStore();
    await renderWithProviders(store, []);

    // Default state: from=07:00, to=09:00, interval=30
    // This generates 5 alarms (07:00, 07:30, 08:00, 08:30, 09:00)

    // Get the SaveButton from setOptions
    await waitFor(() => {
      expect(mockSetOptions).toHaveBeenCalled();
    });

    const lastCall =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    const SaveButton = lastCall.headerRight;

    // Render the save button and press it
    const { getByTestId: getSaveById } = render(
      <PaperProvider>
        <SaveButton />
      </PaperProvider>,
    );

    await act(async () => {
      fireEvent.press(getSaveById("bulk-save-button"));
    });

    // scheduleAlarm should have been called for each generated alarm
    await waitFor(() => {
      expect(scheduleAlarm).toHaveBeenCalledTimes(5);
    });

    // Should navigate back after saving
    expect(mockGoBack).toHaveBeenCalled();

    // Alarms should be stored in the atom
    const storedAlarms = store.get(alarmsAtom);
    expect(storedAlarms).toHaveLength(5);
  });

  it("allows the batch when it reaches exactly 50 enabled alarms", async () => {
    await renderWithProviders(
      createStore(),
      Array.from({ length: 45 }, (_, index) => makeAlarm(index)),
    );

    const options =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    expect(options.headerRight().props.disabled).toBe(false);
  });

  it("disables saving when the batch would create 51 enabled alarms", async () => {
    await renderWithProviders(
      createStore(),
      Array.from({ length: 46 }, (_, index) => makeAlarm(index)),
    );

    const options =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    expect(options.headerRight().props.disabled).toBe(true);
    await options.headerRight().props.onPress();
    expect(scheduleAlarm).not.toHaveBeenCalled();
  });

  it("does not count disabled alarms toward the 50-alarm limit", async () => {
    await renderWithProviders(
      createStore(),
      Array.from({ length: 51 }, (_, index) => makeAlarm(index, false)),
    );

    const options =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    expect(options.headerRight().props.disabled).toBe(false);
  });

  it("checks the native trigger count before scheduling", async () => {
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue(
      Array.from({ length: 46 }, (_, index) => `native-trigger-${index}`),
    );
    const alertSpy = jest.spyOn(Alert, "alert");
    await renderWithProviders(createStore(), []);

    const options =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    await act(async () => {
      await options.headerRight().props.onPress();
    });

    expect(scheduleAlarm).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "alarm.bulkCreate",
      'alarm.bulkWarningLimit:{"total":51}',
    );
    alertSpy.mockRestore();
  });

  it("rolls back every attempted alarm when scheduling fails partway", async () => {
    const store = createStore();
    (scheduleAlarm as jest.Mock)
      .mockResolvedValueOnce("trigger-1")
      .mockResolvedValueOnce("trigger-2")
      .mockRejectedValueOnce(new Error("schedule failed"));
    const alertSpy = jest.spyOn(Alert, "alert");
    await renderWithProviders(store, []);

    const options =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    await act(async () => {
      await options.headerRight().props.onPress();
    });

    await waitFor(() => {
      expect(cancelAlarm).toHaveBeenCalledTimes(3);
    });
    expect(cancelAlarm).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ notifeeTriggerId: "trigger-1" }),
    );
    expect(cancelAlarm).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ notifeeTriggerId: "trigger-2" }),
    );
    expect(cancelAlarm).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ notifeeTriggerId: null }),
    );
    expect(await store.get(alarmsAtom)).toEqual([]);
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "alarm.bulkCreate",
      "alarm.bulkCreateFailed",
    );
    alertSpy.mockRestore();
  });

  it("keeps an alarm when its rollback cannot be confirmed", async () => {
    const store = createStore();
    (scheduleAlarm as jest.Mock)
      .mockResolvedValueOnce("trigger-1")
      .mockRejectedValueOnce(new Error("schedule failed"));
    (cancelAlarm as jest.Mock)
      .mockRejectedValueOnce(new Error("cancel failed"))
      .mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, "alert");
    await renderWithProviders(store, []);

    const options =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    await act(async () => {
      await options.headerRight().props.onPress();
    });

    expect(await store.get(alarmsAtom)).toEqual([
      expect.objectContaining({ notifeeTriggerId: "trigger-1" }),
    ]);
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "alarm.bulkCreate",
      "alarm.bulkCreateFailed",
    );
    alertSpy.mockRestore();
  });
});
