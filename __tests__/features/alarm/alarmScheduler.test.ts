import notifee from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

import {
  cancelAlarm,
  recoverAlarmSchedule,
  rescheduleAllAlarms,
  scheduleAlarm,
} from "../../../src/features/alarm/services/alarmScheduler";
import {
  cancelAlarmAudio,
  scheduleAlarmAudio,
} from "../../../src/features/alarm/services/ringtoneService";
import type { Alarm } from "../../../src/models/Alarm";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getNotificationSettings: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidNotificationSetting: { ENABLED: 1, DISABLED: 0 },
  AuthorizationStatus: { AUTHORIZED: 1 },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn() },
}));

jest.mock("../../../src/features/alarm/services/ringtoneService", () => ({
  scheduleAlarmAudio: jest.fn().mockResolvedValue(undefined),
  cancelAlarmAudio: jest.fn().mockResolvedValue(undefined),
}));

function setPlatform(os: "android" | "ios") {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
}

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Wake up",
    enabled: true,
    targetTimestampMs: Date.now() + 3_600_000,
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

describe("alarmScheduler", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform("ios");
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
      authorizationStatus: 1,
      android: { alarm: 1 },
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalOS,
    });
  });

  describe("iOS", () => {
    it("creates an audible timestamp trigger without native Android audio", async () => {
      const alarm = makeAlarm();

      await expect(scheduleAlarm(alarm)).resolves.toBe("trigger-id");

      const [notification, trigger] = (
        notifee.createTriggerNotification as jest.Mock
      ).mock.calls[0];
      expect(notification).toEqual(
        expect.objectContaining({
          id: alarm.id,
          title: alarm.label,
          data: {
            alarmId: alarm.id,
            occurrenceTimestampMs: String(alarm.targetTimestampMs),
          },
          ios: expect.objectContaining({
            sound: "default",
            foregroundPresentationOptions: expect.objectContaining({
              sound: true,
            }),
          }),
        }),
      );
      expect(notification.android).toBeUndefined();
      expect(trigger).toEqual(
        expect.objectContaining({
          type: 0,
          timestamp: alarm.targetTimestampMs,
          alarmManager: { allowWhileIdle: true },
        }),
      );
      expect(scheduleAlarmAudio).not.toHaveBeenCalled();
    });

    it("does not assign a sound to a silent alarm", async () => {
      await scheduleAlarm(makeAlarm({ soundUri: "__silent__" }));

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.ios).toEqual(
        expect.objectContaining({
          sound: undefined,
          foregroundPresentationOptions: expect.objectContaining({
            sound: false,
          }),
        }),
      );
    });

    it("leaves no trigger to roll back when trigger creation fails", async () => {
      (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("unavailable"),
      );

      await expect(scheduleAlarm(makeAlarm())).rejects.toThrow("unavailable");

      expect(notifee.cancelTriggerNotification).not.toHaveBeenCalled();
      expect(scheduleAlarmAudio).not.toHaveBeenCalled();
    });

    it("cancels only Notifee resources", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: "existing-trigger" });

      await cancelAlarm(alarm);

      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        "existing-trigger",
      );
      expect(cancelAlarmAudio).not.toHaveBeenCalled();
    });
  });

  describe("Android", () => {
    beforeEach(() => setPlatform("android"));

    it("uses the native exact delivery path and removes a legacy trigger", async () => {
      const alarm = makeAlarm({
        soundUri: "content://media/ringtone/5",
        notifeeTriggerId: "legacy-notifee-trigger",
      });

      await expect(scheduleAlarm(alarm)).resolves.toBe(alarm.id);

      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        "legacy-notifee-trigger",
      );
      expect(scheduleAlarmAudio).toHaveBeenCalledWith(
        alarm.id,
        alarm.targetTimestampMs,
        alarm.soundUri,
        alarm.gradualVolumeDurationSec * 1000,
        alarm.autoSilenceMin * 60 * 1000,
        false,
        null,
        [],
        0,
        alarm.label,
        alarm.vibrationEnabled,
      );
    });

    it.each([
      [
        "one-time 24-hour alarm",
        { setInTimeSystem: "24h", repeat: null },
        true,
      ],
      [
        "repeating 24-hour alarm",
        {
          setInTimeSystem: "24h",
          repeat: { type: "interval", intervalMs: 60_000 },
        },
        true,
      ],
      [
        "one-time custom-time alarm",
        { setInTimeSystem: "custom", repeat: null },
        false,
      ],
    ] as Array<[string, Partial<Alarm>, boolean]>)(
      "keeps %s on the correct time basis",
      async (_, overrides, expected) => {
        const alarm = makeAlarm(overrides);

        await scheduleAlarm(alarm);

        expect(scheduleAlarmAudio).toHaveBeenCalledWith(
          alarm.id,
          alarm.targetTimestampMs,
          alarm.soundUri,
          alarm.gradualVolumeDurationSec * 1000,
          alarm.autoSilenceMin * 60 * 1000,
          expected,
          alarm.repeat?.type ?? null,
          alarm.repeat?.weekdays ?? [],
          alarm.repeat?.type === "interval"
            ? (alarm.repeat.intervalMs ?? 0)
            : 0,
          alarm.label,
          alarm.vibrationEnabled,
        );
      },
    );

    it("stores the supplied custom-cycle duration for native boot recovery", async () => {
      const alarm = makeAlarm({
        repeat: { type: "customCycleInterval", customCycleIntervalDays: 2 },
      });

      await scheduleAlarm(alarm, { cycleLengthMinutes: 900, baseTimeMs: 0 });

      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(scheduleAlarmAudio).toHaveBeenCalledWith(
        alarm.id,
        alarm.targetTimestampMs,
        alarm.soundUri,
        alarm.gradualVolumeDurationSec * 1000,
        alarm.autoSilenceMin * 60 * 1000,
        false,
        "customCycleInterval",
        [],
        2 * 900 * 60 * 1000,
        alarm.label,
        alarm.vibrationEnabled,
      );
    });

    it("uses normalized persisted cycle settings when no config is supplied", async () => {
      const alarm = makeAlarm({
        repeat: { type: "customCycleInterval", customCycleIntervalDays: 2 },
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ cycleConfig: { cycleLengthMinutes: 900 } }),
      );

      await scheduleAlarm(alarm);

      expect(scheduleAlarmAudio).toHaveBeenCalledWith(
        alarm.id,
        alarm.targetTimestampMs,
        alarm.soundUri,
        alarm.gradualVolumeDurationSec * 1000,
        alarm.autoSilenceMin * 60 * 1000,
        false,
        "customCycleInterval",
        [],
        2 * 900 * 60 * 1000,
        alarm.label,
        alarm.vibrationEnabled,
      );
    });

    it("does not create a visual fallback when native scheduling fails", async () => {
      (scheduleAlarmAudio as jest.Mock).mockRejectedValueOnce(
        new Error("native failure"),
      );

      await expect(scheduleAlarm(makeAlarm())).rejects.toThrow(
        "native failure",
      );

      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("rejects scheduling when exact alarms are disabled", async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
        authorizationStatus: 1,
        android: { alarm: 0 },
      });

      await expect(scheduleAlarm(makeAlarm())).rejects.toMatchObject({
        failure: "exact-alarms-disabled",
      });
      expect(scheduleAlarmAudio).not.toHaveBeenCalled();
    });

    it("schedules native audio when notifications are disabled", async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
        authorizationStatus: 0,
        android: { alarm: 1 },
      });

      await expect(scheduleAlarm(makeAlarm())).resolves.toBe("test-alarm-1");

      expect(scheduleAlarmAudio).toHaveBeenCalled();
      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("cancels native delivery and its stable trigger identifier", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: null });

      await cancelAlarm(alarm);

      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(alarm.id);
      expect(cancelAlarmAudio).toHaveBeenCalledWith(alarm.id);
    });
  });

  it("rejects iOS scheduling when notifications are disabled", async () => {
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
      authorizationStatus: 0,
    });

    await expect(scheduleAlarm(makeAlarm())).rejects.toMatchObject({
      failure: "notifications-disabled",
    });
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it("recovers an iOS alarm with its Notifee trigger identifier", async () => {
    await expect(recoverAlarmSchedule(makeAlarm(), 1234)).resolves.toEqual(
      expect.objectContaining({
        enabled: true,
        notifeeTriggerId: "trigger-id",
      }),
    );
  });

  it("disables an iOS alarm when its trigger cannot be scheduled", async () => {
    (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
      new Error("unavailable"),
    );

    await expect(recoverAlarmSchedule(makeAlarm(), 1234)).resolves.toEqual(
      expect.objectContaining({
        enabled: false,
        notifeeTriggerId: null,
        updatedAt: 1234,
      }),
    );
  });

  it("reschedules only enabled iOS alarms", async () => {
    await rescheduleAllAlarms([
      makeAlarm({ id: "a1", enabled: true }),
      makeAlarm({ id: "a2", enabled: false }),
      makeAlarm({ id: "a3", enabled: true }),
    ]);

    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
    expect(
      (notifee.createTriggerNotification as jest.Mock).mock.calls[0][0].id,
    ).toBe("a1");
    expect(
      (notifee.createTriggerNotification as jest.Mock).mock.calls[1][0].id,
    ).toBe("a3");
  });
});
