import notifee from "@notifee/react-native";
import {
  scheduleAlarm,
  cancelAlarm,
  rescheduleAllAlarms,
} from "../../../src/features/alarm/services/alarmScheduler";
import type { Alarm } from "../../../src/models/Alarm";

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
      expect(notification.android.channelId).toBe("alarm");
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
  });

  describe("cancelAlarm", () => {
    it("should cancel trigger notification when triggerId exists", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: "existing-trigger" });
      await cancelAlarm(alarm);

      expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
        "existing-trigger",
      );
      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
    });

    it("should only cancel notification when no triggerId", async () => {
      const alarm = makeAlarm({ notifeeTriggerId: null });
      await cancelAlarm(alarm);

      expect(notifee.cancelTriggerNotification).not.toHaveBeenCalled();
      expect(notifee.cancelNotification).toHaveBeenCalledWith(alarm.id);
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
