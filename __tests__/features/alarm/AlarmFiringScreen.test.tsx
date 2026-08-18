import notifee from "@notifee/react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { BackHandler, DeviceEventEmitter, StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { AlarmFiringScreen } from "../../../src/features/alarm/screens/AlarmFiringScreen";
import {
  cancelAlarm,
  scheduleAlarm,
} from "../../../src/features/alarm/services/alarmScheduler";
import { RingtoneService } from "../../../src/features/alarm/services/ringtoneService";
import type { Alarm } from "../../../src/models/Alarm";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
} from "../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

// Use sync storage so atomWithStorage does not trigger Suspense
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

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: Record<string, unknown> = { alarmId: "test-alarm-1" };

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactModule = require("react");
    ReactModule.useEffect(effect, [effect]);
  },
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    cancelNotification: jest.fn(() => Promise.resolve()),
    cancelDisplayedNotification: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../../src/features/alarm/services/alarmScheduler", () => ({
  cancelAlarm: jest.fn(() => Promise.resolve()),
  scheduleAlarm: jest.fn(() => Promise.resolve("trigger-id")),
}));

jest.mock("../../../src/features/alarm/services/ringtoneService", () => ({
  RingtoneService: {
    stopAlarmSound: jest.fn(() => Promise.resolve()),
    setAlarmVolumeButtonBehavior: jest.fn(() => Promise.resolve()),
  },
}));

let mockDismissalContainerProps: Record<string, unknown> = {};
let mockHardwareBackHandler: (() => boolean | null | undefined) | undefined;
const mockBackHandlerRemove = jest.fn();

jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
  mockHardwareBackHandler = handler;
  return { remove: mockBackHandlerRemove };
});

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, right: 12, bottom: 34, left: 8 },
};

jest.mock(
  "../../../src/features/alarm/components/dismissal/DismissalContainer",
  () => ({
    DismissalContainer: (props: {
      onDismiss: () => void;
      onSnooze: () => void;
      canSnooze: boolean;
      difficulty: number;
      method: string;
    }) => {
      mockDismissalContainerProps = props;
      const ReactNative = require("react-native");
      return (
        <ReactNative.View testID="dismissal-container">
          <ReactNative.Button
            testID="dismiss-button"
            title="Dismiss"
            onPress={props.onDismiss}
          />
          {props.canSnooze && (
            <ReactNative.Button
              testID="snooze-button"
              title="Snooze"
              onPress={props.onSnooze}
            />
          )}
        </ReactNative.View>
      );
    },
  }),
);

jest.mock("../../../src/features/alarm/strategies", () => ({}));

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Morning Alarm",
    enabled: true,
    targetTimestampMs: Date.now() + 3600000,
    setInTimeSystem: "custom",
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
  initialSettings: AppSettings = DEFAULT_SETTINGS,
) {
  store.set(settingsAtom, initialSettings);
  store.set(alarmsAtom, initialAlarms);
  const utils = await render(
    <JotaiProvider store={store}>
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PaperProvider>
          <AlarmFiringScreen />
        </PaperProvider>
      </SafeAreaProvider>
    </JotaiProvider>,
  );
  // Flush pending async atom resolutions
  await act(async () => {});
  return { ...utils, store };
}

describe("AlarmFiringScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRouteParams = { alarmId: "test-alarm-1" };
    mockDismissalContainerProps = {};
    mockHardwareBackHandler = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render with testID "alarm-firing-screen" when alarm found', async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);
    expect(getByTestId("alarm-firing-screen")).toBeTruthy();
  });

  it("blocks the Android back button while an alarm is firing", async () => {
    await renderWithProviders(createStore(), [makeAlarm()]);

    expect(mockHardwareBackHandler?.()).toBe(true);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("positions dismissal controls within safe area insets", async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);

    expect(
      StyleSheet.flatten(getByTestId("alarm-firing-screen").props.style),
    ).toMatchObject({
      paddingTop: 56,
      paddingRight: 44,
      paddingBottom: 66,
      paddingLeft: 40,
    });
  });

  it("should display alarm label when present", async () => {
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({ label: "Wake Up" }),
    ]);
    expect(getByText("Wake Up")).toBeTruthy();
  });

  it('should display t("alarm.title") when alarm has no label', async () => {
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({ label: "" }),
    ]);
    expect(getByText("alarm.title")).toBeTruthy();
  });

  it("should display time in custom time format", async () => {
    // Use baseTimeMs=0 and a known targetTimestampMs
    // With default cycleConfig (cycleLengthMinutes=1560, baseTimeMs=0)
    // targetTimestampMs = 3 * 3600000 + 30 * 60000 = 12600000 => 03:30
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({ targetTimestampMs: 12600000 }),
    ]);
    expect(getByText("03:30")).toBeTruthy();
  });

  it("displays the delivered occurrence after the next repeat is scheduled", async () => {
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({
        targetTimestampMs: 20_000_000,
        activeOccurrenceTimestampMs: 12_600_000,
        lastDeliveredOccurrenceTimestampMs: 12_600_000,
      }),
    ]);

    expect(getByText("03:30")).toBeTruthy();
  });

  it('should show "Alarm not found" when alarm id doesn\'t match', async () => {
    mockRouteParams = { alarmId: "non-existent-alarm" };
    const { getByText, queryByTestId } = await renderWithProviders(
      createStore(),
      [makeAlarm()],
    );
    expect(getByText("Alarm not found")).toBeTruthy();
    expect(queryByTestId("alarm-firing-screen")).toBeNull();
  });

  it("cancels the alarm and records the dismissal", async () => {
    const store = createStore();
    const alarm = makeAlarm();
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    await waitFor(() => {
      expect(cancelAlarm).toHaveBeenCalledWith(alarm);
    });

    const updatedAlarms = await store.get(alarmsAtom);
    expect(updatedAlarms[0].lastFiredAt).not.toBeNull();
    expect(updatedAlarms[0].lastFiredAt).toBeGreaterThan(0);
  });

  it("preserves concurrent updates to other alarms while dismissal is pending", async () => {
    const store = createStore();
    const alarm = makeAlarm({ id: "dismissed-alarm" });
    const otherAlarm = makeAlarm({ id: "other-alarm", label: "Before" });
    let resolveCancellation: (() => void) | undefined;
    (cancelAlarm as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCancellation = resolve;
        }),
    );
    mockRouteParams = { alarmId: alarm.id };
    const { getByTestId } = await renderWithProviders(store, [
      alarm,
      otherAlarm,
    ]);

    fireEvent.press(getByTestId("dismiss-button"));
    const updatedOtherAlarm = { ...otherAlarm, label: "Updated elsewhere" };
    await act(async () => {
      store.set(alarmsAtom, [alarm, updatedOtherAlarm]);
    });
    resolveCancellation?.();

    await waitFor(() => {
      expect(store.get(alarmsAtom)).toEqual(
        expect.arrayContaining([updatedOtherAlarm]),
      );
    });
  });

  it("removes a test alarm after dismissal", async () => {
    const store = createStore();
    const alarm = makeAlarm({ isTest: true });
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    await waitFor(async () => {
      expect(await store.get(alarmsAtom)).toEqual([]);
    });
    expect(cancelAlarm).toHaveBeenCalledWith(alarm);
  });

  it("dismisses a delivered occurrence without cancelling its next repeat", async () => {
    const store = createStore();
    const alarm = makeAlarm({
      repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      targetTimestampMs: 2_000_000,
      activeOccurrenceTimestampMs: 1_000_000,
      lastDeliveredOccurrenceTimestampMs: 1_000_000,
      notifeeTriggerId: "next-trigger",
    });
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    expect(cancelAlarm).not.toHaveBeenCalled();
    expect(notifee.cancelDisplayedNotification).toHaveBeenCalledWith(alarm.id);
    expect(RingtoneService.stopAlarmSound).toHaveBeenCalledWith(alarm.id);
    expect(scheduleAlarm).not.toHaveBeenCalled();
    const updatedAlarms = await store.get(alarmsAtom);
    expect(updatedAlarms[0]).toMatchObject({
      targetTimestampMs: 2_000_000,
      activeOccurrenceTimestampMs: null,
      notifeeTriggerId: "next-trigger",
    });
  });

  it("should navigate back on dismiss", async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it("should schedule snoozed alarm and navigate back on snooze", async () => {
    const store = createStore();
    const { getByTestId } = await renderWithProviders(store, [makeAlarm()]);

    await act(async () => {
      fireEvent.press(getByTestId("snooze-button"));
    });

    await waitFor(() => {
      expect(scheduleAlarm).toHaveBeenCalled();
    });

    const scheduledArg = (scheduleAlarm as jest.Mock).mock.calls[0][0];
    expect(scheduledArg.targetTimestampMs).toBeGreaterThan(Date.now() - 1000);
    expect(scheduledArg.snoozeCount).toBe(1);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it("should increment snoozeCount on snooze", async () => {
    const store = createStore();
    const alarm = makeAlarm({ snoozeCount: 1 });
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("snooze-button"));
    });

    const updatedAlarms = await store.get(alarmsAtom);
    expect(updatedAlarms[0].snoozeCount).toBe(2);
  });

  it("re-enables a delivered one-shot alarm when it is snoozed", async () => {
    const store = createStore();
    const occurrenceTimestampMs = Date.now() - 1_000;
    const alarm = makeAlarm({
      enabled: false,
      targetTimestampMs: occurrenceTimestampMs,
      activeOccurrenceTimestampMs: occurrenceTimestampMs,
      lastDeliveredOccurrenceTimestampMs: occurrenceTimestampMs,
    });
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("snooze-button"));
    });

    expect(scheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect((await store.get(alarmsAtom))[0].enabled).toBe(true);
  });

  it("resets the snooze count after final dismissal", async () => {
    const store = createStore();
    const occurrenceTimestampMs = Date.now() - 1_000;
    const alarm = makeAlarm({
      snoozeCount: 2,
      repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      targetTimestampMs: Date.now() + 60 * 60 * 1000,
      activeOccurrenceTimestampMs: occurrenceTimestampMs,
      lastDeliveredOccurrenceTimestampMs: occurrenceTimestampMs,
    });
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    expect((await store.get(alarmsAtom))[0].snoozeCount).toBe(0);
  });

  it("ignores a second dismissal while the first is running", async () => {
    let finishCancellation: (() => void) | undefined;
    (cancelAlarm as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCancellation = resolve;
        }),
    );
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);

    fireEvent.press(getByTestId("dismiss-button"));
    fireEvent.press(getByTestId("dismiss-button"));
    expect(cancelAlarm).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishCancellation?.();
    });
  });

  describe("hardware volume buttons", () => {
    it("uses the configured snooze action", async () => {
      await renderWithProviders(createStore(), [makeAlarm()]);

      expect(RingtoneService.setAlarmVolumeButtonBehavior).toHaveBeenCalledWith(
        "snooze",
      );
      await act(async () => {
        DeviceEventEmitter.emit("AlarmVolumeButtonPressed", "snooze");
      });
      expect(scheduleAlarm).toHaveBeenCalled();
    });

    it("falls back to dismissal after the snooze limit", async () => {
      await renderWithProviders(createStore(), [
        makeAlarm({ snoozeCount: 3, snoozeMaxCount: 3 }),
      ]);

      expect(RingtoneService.setAlarmVolumeButtonBehavior).toHaveBeenCalledWith(
        "dismiss",
      );
    });

    it("leaves volume keys to Android in volume mode", async () => {
      await renderWithProviders(createStore(), [makeAlarm()], {
        ...DEFAULT_SETTINGS,
        alarmDefaults: {
          ...DEFAULT_SETTINGS.alarmDefaults,
          volumeButtonBehavior: "volume",
        },
      });

      expect(RingtoneService.setAlarmVolumeButtonBehavior).toHaveBeenCalledWith(
        null,
      );
    });
  });

  it("bases snooze recurrence on the delivered occurrence", async () => {
    const activeOccurrenceTimestampMs = 1_000_000;
    const alarm = makeAlarm({
      repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      targetTimestampMs: 2_000_000,
      activeOccurrenceTimestampMs,
      lastDeliveredOccurrenceTimestampMs: activeOccurrenceTimestampMs,
      notifeeTriggerId: "next-trigger",
    });
    const { getByTestId } = await renderWithProviders(createStore(), [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("snooze-button"));
    });

    const snoozedAlarm = (scheduleAlarm as jest.Mock).mock.calls[0][0];
    expect(cancelAlarm).toHaveBeenCalledWith(alarm);
    expect(snoozedAlarm.recurrenceAnchorTimestampMs).toBe(
      activeOccurrenceTimestampMs,
    );
    expect(snoozedAlarm.activeOccurrenceTimestampMs).toBeNull();
  });

  it("should pass canSnooze=false to DismissalContainer when snoozeCount >= snoozeMaxCount", async () => {
    const alarm = makeAlarm({ snoozeCount: 3, snoozeMaxCount: 3 });
    const { queryByTestId } = await renderWithProviders(createStore(), [alarm]);

    expect(queryByTestId("snooze-button")).toBeNull();
    expect(queryByTestId("dismiss-button")).toBeTruthy();
  });

  describe("math difficulty", () => {
    it("passes alarm mathDifficulty to DismissalContainer", async () => {
      const alarm = makeAlarm({
        mathDifficulty: 2,
        dismissalMethod: "math",
      });
      await renderWithProviders(createStore(), [alarm]);

      expect(mockDismissalContainerProps).toMatchObject({ difficulty: 2 });
    });

    it("defaults to difficulty 1 when mathDifficulty is undefined", async () => {
      const alarm = makeAlarm({
        mathDifficulty: undefined as any,
      });
      await renderWithProviders(createStore(), [alarm]);

      expect(mockDismissalContainerProps).toMatchObject({ difficulty: 1 });
    });

    it("passes difficulty 3 for hard math alarm", async () => {
      const alarm = makeAlarm({
        mathDifficulty: 3,
        dismissalMethod: "math",
      });
      await renderWithProviders(createStore(), [alarm]);

      expect(mockDismissalContainerProps).toMatchObject({ difficulty: 3 });
    });
  });

  describe("preview mode", () => {
    beforeEach(() => {
      mockRouteParams = { isPreview: true, alarm: makeAlarm() };
    });

    it("should display preview badge", async () => {
      const { getByTestId } = await renderWithProviders(createStore());

      expect(getByTestId("preview-badge")).toBeTruthy();
    });

    it("should display close preview button", async () => {
      const { getByTestId } = await renderWithProviders(createStore());

      expect(getByTestId("close-preview-button")).toBeTruthy();
    });

    it("should navigate back when close preview button is pressed", async () => {
      const { getByTestId } = await renderWithProviders(createStore());

      await act(async () => {
        fireEvent.press(getByTestId("close-preview-button"));
      });

      expect(mockGoBack).toHaveBeenCalled();
    });

    it("does not cancel a stored alarm on preview dismiss", async () => {
      const { getByTestId } = await renderWithProviders(createStore());

      await act(async () => {
        fireEvent.press(getByTestId("dismiss-button"));
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalled();
    });

    it("does not schedule or cancel an alarm on preview snooze", async () => {
      const { getByTestId } = await renderWithProviders(createStore());

      await act(async () => {
        fireEvent.press(getByTestId("snooze-button"));
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(scheduleAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalled();
    });

    it("should not modify alarms atom on dismiss", async () => {
      const store = createStore();
      const storedAlarm = makeAlarm();
      const { getByTestId } = await renderWithProviders(store, [storedAlarm]);

      await act(async () => {
        fireEvent.press(getByTestId("dismiss-button"));
      });

      const updatedAlarms = await store.get(alarmsAtom);
      expect(updatedAlarms[0].lastFiredAt).toBeNull();
    });

    it("should render alarm from params, not from store", async () => {
      const previewAlarm = makeAlarm({
        id: "preview-only",
        label: "Preview Alarm",
      });
      mockRouteParams = { isPreview: true, alarm: previewAlarm };

      const { getByText } = await renderWithProviders(createStore());

      expect(getByText("Preview Alarm")).toBeTruthy();
    });

    it("should not show preview badge in normal mode", async () => {
      mockRouteParams = { alarmId: "test-alarm-1" };
      const { queryByTestId } = await renderWithProviders(createStore(), [
        makeAlarm(),
      ]);

      expect(queryByTestId("preview-badge")).toBeNull();
    });
  });

  describe("auto-silence timeout edge cases", () => {
    beforeEach(() => {
      mockRouteParams = { alarmId: "test-alarm-1" };
    });

    it("does not set timeout when autoSilenceMin is 0", async () => {
      const alarm = makeAlarm({ autoSilenceMin: 0 });
      await renderWithProviders(createStore(), [alarm]);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it("does not set timeout when autoSilenceMin is negative", async () => {
      const alarm = makeAlarm({ autoSilenceMin: -5 });
      await renderWithProviders(createStore(), [alarm]);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it("does not set timeout in preview mode", async () => {
      mockRouteParams = {
        isPreview: true,
        alarm: makeAlarm({ autoSilenceMin: 5 }),
      };
      await renderWithProviders(createStore());

      await act(async () => {
        jest.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe("auto-silence timeout", () => {
    beforeEach(() => {
      mockRouteParams = { alarmId: "test-alarm-1" };
    });

    it("should auto-dismiss after autoSilenceMin minutes", async () => {
      const alarm = makeAlarm({
        activeOccurrenceTimestampMs: Date.now(),
        autoSilenceMin: 5,
      });
      await renderWithProviders(createStore(), [alarm]);

      await act(async () => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });

      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalledWith(alarm);
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it("should not auto-dismiss when autoSilenceMin is 0", async () => {
      const alarm = makeAlarm({ autoSilenceMin: 0 });
      await renderWithProviders(createStore(), [alarm]);

      await act(async () => {
        jest.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it("should not set auto-silence timeout in preview mode", async () => {
      mockRouteParams = {
        isPreview: true,
        alarm: makeAlarm({ autoSilenceMin: 1 }),
      };
      await renderWithProviders(createStore());

      await act(async () => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it("should not auto-dismiss before the timeout elapses", async () => {
      const alarm = makeAlarm({
        activeOccurrenceTimestampMs: Date.now(),
        autoSilenceMin: 10,
      });
      await renderWithProviders(createStore(), [alarm]);

      // Advance to just before the timeout
      await act(async () => {
        jest.advanceTimersByTime(10 * 60 * 1000 - 1);
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();

      // Now advance past the threshold
      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalled();
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it("uses only the remaining auto-silence duration after delivery", async () => {
      const alarm = makeAlarm({
        activeOccurrenceTimestampMs: Date.now() - 3 * 60 * 1000,
        autoSilenceMin: 5,
      });
      await renderWithProviders(createStore(), [alarm]);

      await act(async () => {
        jest.advanceTimersByTime(2 * 60 * 1000 - 1);
      });
      expect(cancelAlarm).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalledWith(alarm);
      });
    });

    it("stops native alarm audio when the screen unmounts", async () => {
      const { unmount } = await renderWithProviders(createStore(), [
        makeAlarm(),
      ]);

      unmount();

      expect(RingtoneService.stopAlarmSound).toHaveBeenCalledWith(
        "test-alarm-1",
      );
    });
  });
});
