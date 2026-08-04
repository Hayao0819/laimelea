import notifee from "@notifee/react-native";
import { NativeModules } from "react-native";

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
    createChannel: jest.fn().mockResolvedValue("alarm"),
    createChannelGroup: jest.fn().mockResolvedValue(undefined),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getNotificationSettings: jest.fn(),
    openAlarmPermissionSettings: jest.fn(),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationSetting: { ENABLED: 1, DISABLED: 0 },
  AndroidCategory: { ALARM: "alarm" },
  AuthorizationStatus: { AUTHORIZED: 1 },
  EventType: { PRESS: 1, ACTION_PRESS: 7, DISMISSED: 2 },
}));

jest.mock("../../../src/features/alarm/services/ringtoneService", () => ({
  scheduleAlarmAudio: jest.fn().mockResolvedValue(undefined),
  cancelAlarmAudio: jest.fn().mockResolvedValue(undefined),
}));

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Wake up",
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

describe("alarmScheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (notifee.createChannel as jest.Mock).mockImplementation(
      async ({ id }: { id: string }) => id,
    );
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
      authorizationStatus: 1,
      android: { alarm: 1 },
    });
  });

  describe("scheduleAlarm", () => {
    it("should call createTriggerNotification with correct params", async () => {
      const alarm = makeAlarm();
      const triggerId = await scheduleAlarm(alarm);

      expect(triggerId).toBe("trigger-id");
      expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);

      const [notification, trigger] = (
        notifee.createTriggerNotification as jest.Mock
      ).mock.calls[0];

      expect(notification.id).toBe(alarm.id);
      expect(notification.data.alarmId).toBe(alarm.id);
      expect(notification.data.occurrenceTimestampMs).toBe(
        String(alarm.targetTimestampMs),
      );
      expect(notification.android.channelId).toMatch(/^alarm-v2-/);
      expect(notification.android.fullScreenAction).toBeDefined();
      expect(trigger.type).toBe(0); // TriggerType.TIMESTAMP
      expect(trigger.timestamp).toBe(alarm.targetTimestampMs);
      expect(trigger.alarmManager.allowWhileIdle).toBe(true);
    });

    it("should use alarm label as notification title", async () => {
      const alarm = makeAlarm({ label: "Morning" });
      await scheduleAlarm(alarm);

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.title).toBe("Morning");
    });

    it("should use 'Alarm' as default title when label is empty", async () => {
      const alarm = makeAlarm({ label: "" });
      await scheduleAlarm(alarm);

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.title).toBe("Alarm");
    });

    it("uses native audio for a custom sound and keeps the notification channel silent", async () => {
      const alarm = makeAlarm({ soundUri: "content://media/ringtone/5" });
      await scheduleAlarm(alarm);

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ sound: undefined }),
      );
      expect(scheduleAlarmAudio).toHaveBeenCalledWith(
        alarm.id,
        alarm.targetTimestampMs,
        "content://media/ringtone/5",
        30 * 1000,
        15 * 60 * 1000,
      );
      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.android.loopSound).toBe(false);
    });

    it("uses native audio for the default sound", async () => {
      const alarm = makeAlarm({ soundUri: null });
      await scheduleAlarm(alarm);

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ sound: undefined }),
      );
    });

    it("creates a silent channel without enabling looped sound", async () => {
      const alarm = makeAlarm({ soundUri: "__silent__" });
      await scheduleAlarm(alarm);

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.android.loopSound).toBe(false);
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ sound: undefined }),
      );
    });

    it("creates a vibrating channel when vibrationEnabled is true", async () => {
      const alarm = makeAlarm({ vibrationEnabled: true });
      await scheduleAlarm(alarm);

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          vibration: true,
          vibrationPattern: [300, 500, 200, 500],
        }),
      );
    });

    it("creates a non-vibrating channel when vibrationEnabled is false", async () => {
      const alarm = makeAlarm({ vibrationEnabled: false });
      await scheduleAlarm(alarm);

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          vibration: false,
          vibrationPattern: undefined,
        }),
      );
    });

    it("uses timeoutAfter to stop an alarm without opening AlarmFiringScreen", async () => {
      const alarm = makeAlarm({ autoSilenceMin: 5 });
      await scheduleAlarm(alarm);

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.android.timeoutAfter).toBe(5 * 60 * 1000);
    });

    it("does not set a notification timeout when auto silence is disabled", async () => {
      const alarm = makeAlarm({ autoSilenceMin: 0 });
      await scheduleAlarm(alarm);

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.android.timeoutAfter).toBeUndefined();
    });

    it("rejects scheduling when notifications are disabled", async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
        authorizationStatus: 0,
        android: { alarm: 1 },
      });

      await expect(scheduleAlarm(makeAlarm())).rejects.toMatchObject({
        failure: "notifications-disabled",
      });
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
      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("falls back to a heads-up notification when full-screen intent is disabled", async () => {
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getAlarmCapabilities: jest.fn().mockResolvedValue({
          canScheduleExactAlarms: true,
          canUseFullScreenIntent: false,
        }),
      };

      await scheduleAlarm(makeAlarm());

      const [notification] = (notifee.createTriggerNotification as jest.Mock)
        .mock.calls[0];
      expect(notification.android.fullScreenAction).toBeUndefined();
    });

    it("cancels the visual trigger when native audio scheduling fails", async () => {
      (scheduleAlarmAudio as jest.Mock).mockRejectedValueOnce(
        new Error("native failure"),
      );

      await expect(scheduleAlarm(makeAlarm())).rejects.toThrow(
        "native failure",
      );
      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        "trigger-id",
      );
    });
  });

  describe("cancelAlarm", () => {
    it("should cancel trigger notification when triggerId exists", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: "existing-trigger" });
      await cancelAlarm(alarm);

      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        "existing-trigger",
      );
      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
      expect(cancelAlarmAudio).toHaveBeenCalledWith(alarm.id);
    });

    it("should only cancel notification when no triggerId", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: null });
      await cancelAlarm(alarm);

      expect(notifee.cancelTriggerNotification).not.toHaveBeenCalled();
      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
    });

    it("attempts every cancellation when native audio cleanup fails", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: "existing-trigger" });
      (cancelAlarmAudio as jest.Mock).mockRejectedValueOnce(
        new Error("native cleanup failed"),
      );

      await expect(cancelAlarm(alarm)).rejects.toThrow("native cleanup failed");

      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        "existing-trigger",
      );
    });
  });

  describe("recoverAlarmSchedule", () => {
    it("updates the trigger identifier when recovery succeeds", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });

      await expect(recoverAlarmSchedule(alarm, 1234)).resolves.toEqual(
        expect.objectContaining({
          enabled: true,
          notifeeTriggerId: "trigger-id",
        }),
      );
    });

    it("disables the alarm when recovery cannot schedule it", async () => {
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
  });

  describe("rescheduleAllAlarms", () => {
    it("should schedule only enabled alarms", async () => {
      const alarms = [
        makeAlarm({ id: "a1", enabled: true }),
        makeAlarm({ id: "a2", enabled: false }),
        makeAlarm({ id: "a3", enabled: true }),
      ];

      await rescheduleAllAlarms(alarms);

      expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
      const calls = (notifee.createTriggerNotification as jest.Mock).mock.calls;
      expect(calls[0][0].id).toBe("a1");
      expect(calls[1][0].id).toBe("a3");
    });

    it("should not schedule anything when all alarms are disabled", async () => {
      const alarms = [
        makeAlarm({ id: "a1", enabled: false }),
        makeAlarm({ id: "a2", enabled: false }),
      ];

      await rescheduleAllAlarms(alarms);

      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("should handle empty alarm list", async () => {
      await rescheduleAllAlarms([]);
      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });
  });
});
