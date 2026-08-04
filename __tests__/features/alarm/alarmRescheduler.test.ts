import notifee from "@notifee/react-native";

import {
  calculateNextAlarmTime,
  getAlarmToSchedule,
  rescheduleAllEnabledAlarms,
  scheduleNextAlarmOccurrence,
} from "../../../src/features/alarm/services/alarmRescheduler";
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
    getNotificationSettings: jest.fn().mockResolvedValue({
      authorizationStatus: 1,
      android: { alarm: 1 },
    }),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4, MAX: 5 },
  AndroidCategory: { ALARM: "alarm" },
  AndroidNotificationSetting: { DISABLED: 0 },
  AuthorizationStatus: { AUTHORIZED: 1 },
}));

jest.mock("../../../src/features/alarm/services/ringtoneService", () => ({
  cancelAlarmAudio: jest.fn().mockResolvedValue(undefined),
  scheduleAlarmAudio: jest.fn().mockResolvedValue(undefined),
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

describe("alarmRescheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateNextAlarmTime", () => {
    it("should return targetTimestampMs for future non-repeating alarm", () => {
      const futureTime = Date.now() + 3600000;
      const alarm = makeAlarm({ targetTimestampMs: futureTime, repeat: null });
      expect(calculateNextAlarmTime(alarm)).toBe(futureTime);
    });

    it("should return null for past non-repeating alarm", () => {
      const pastTime = Date.now() - 3600000;
      const alarm = makeAlarm({ targetTimestampMs: pastTime, repeat: null });
      expect(calculateNextAlarmTime(alarm)).toBeNull();
    });

    describe("weekdays repeat", () => {
      it("should calculate next weekday time", () => {
        const now = Date.now();
        const today = new Date(now);
        const todayDay = today.getDay();
        // Pick a weekday that is tomorrow
        const tomorrowDay = (todayDay + 1) % 7;

        const alarm = makeAlarm({
          targetTimestampMs: now - 3600000, // past time (keeps hours)
          repeat: { type: "weekdays", weekdays: [tomorrowDay] },
        });

        const result = calculateNextAlarmTime(alarm);
        expect(result).not.toBeNull();
        expect(result!).toBeGreaterThan(now);

        const resultDate = new Date(result!);
        expect(resultDate.getDay()).toBe(tomorrowDay);
      });

      it("should skip to next week if today's time has passed", () => {
        const now = Date.now();
        const today = new Date(now);
        const todayDay = today.getDay();

        // Set target far in the past (same day but hours already passed)
        const pastToday = new Date(now);
        pastToday.setHours(0, 0, 0, 0); // midnight today => already passed

        const alarm = makeAlarm({
          targetTimestampMs: pastToday.getTime(),
          repeat: { type: "weekdays", weekdays: [todayDay] },
        });

        const result = calculateNextAlarmTime(alarm);
        expect(result).not.toBeNull();
        expect(result!).toBeGreaterThan(now);
      });

      it("should return null for empty weekdays array", () => {
        const alarm = makeAlarm({
          targetTimestampMs: Date.now() - 3600000,
          repeat: { type: "weekdays", weekdays: [] },
        });
        expect(calculateNextAlarmTime(alarm)).toBeNull();
      });

      it("should return null when weekdays is undefined", () => {
        const alarm = makeAlarm({
          targetTimestampMs: Date.now() - 3600000,
          repeat: { type: "weekdays" },
        });
        expect(calculateNextAlarmTime(alarm)).toBeNull();
      });
    });

    describe("interval repeat", () => {
      it("should return targetTimestampMs when still in the future", () => {
        const futureTime = Date.now() + 3600000;
        const alarm = makeAlarm({
          targetTimestampMs: futureTime,
          repeat: { type: "interval", intervalMs: 86400000 },
        });
        expect(calculateNextAlarmTime(alarm)).toBe(futureTime);
      });

      it("should calculate next interval time for past alarm", () => {
        const now = Date.now();
        const intervalMs = 3600000; // 1 hour
        // Set target 2.5 hours ago => next should be 0.5 hours from now
        const pastTime = now - 2.5 * intervalMs;

        const alarm = makeAlarm({
          targetTimestampMs: pastTime,
          repeat: { type: "interval", intervalMs },
        });

        const result = calculateNextAlarmTime(alarm);
        expect(result).not.toBeNull();
        expect(result!).toBeGreaterThan(now);
        // Should be pastTime + 3 * intervalMs
        expect(result!).toBe(pastTime + 3 * intervalMs);
      });

      it("should return null for zero intervalMs", () => {
        const alarm = makeAlarm({
          targetTimestampMs: Date.now() - 3600000,
          repeat: { type: "interval", intervalMs: 0 },
        });
        expect(calculateNextAlarmTime(alarm)).toBeNull();
      });

      it("should return null when intervalMs is undefined", () => {
        const alarm = makeAlarm({
          targetTimestampMs: Date.now() - 3600000,
          repeat: { type: "interval" },
        });
        expect(calculateNextAlarmTime(alarm)).toBeNull();
      });
    });

    describe("customCycleInterval repeat", () => {
      it("should calculate next time based on custom cycle days", () => {
        const now = Date.now();
        const cycleDays = 2;
        const intervalMs = cycleDays * 24 * 60 * 60 * 1000;
        // Set target 3 days ago => next should be 1 day from now
        const pastTime = now - 3 * 24 * 60 * 60 * 1000;

        const alarm = makeAlarm({
          targetTimestampMs: pastTime,
          repeat: {
            type: "customCycleInterval",
            customCycleIntervalDays: cycleDays,
          },
        });

        const result = calculateNextAlarmTime(alarm);
        expect(result).not.toBeNull();
        expect(result!).toBeGreaterThan(now);
        // Should be pastTime + 2 * intervalMs (=4 days ahead of pastTime, 1 day from now)
        expect(result!).toBe(pastTime + 2 * intervalMs);
      });

      it("should return null for zero customCycleIntervalDays", () => {
        const alarm = makeAlarm({
          targetTimestampMs: Date.now() - 3600000,
          repeat: { type: "customCycleInterval", customCycleIntervalDays: 0 },
        });
        expect(calculateNextAlarmTime(alarm)).toBeNull();
      });

      it("uses the configured custom cycle length", () => {
        const now = Date.now();
        const cycleLengthMinutes = 26 * 60;
        const pastTime = now - 3 * 26 * 60 * 60 * 1000;
        const alarm = makeAlarm({
          targetTimestampMs: pastTime,
          repeat: {
            type: "customCycleInterval",
            customCycleIntervalDays: 2,
          },
        });

        const result = calculateNextAlarmTime(
          alarm,
          { baseTimeMs: 0, cycleLengthMinutes },
          now,
        );

        expect(result).toBe(pastTime + 4 * 26 * 60 * 60 * 1000);
      });
    });

    it("consumes skipNextOccurrence and schedules the following repeat", () => {
      const now = Date.now();
      const intervalMs = 60 * 60 * 1000;
      const alarm = makeAlarm({
        targetTimestampMs: now - intervalMs,
        repeat: { type: "interval", intervalMs },
        skipNextOccurrence: true,
      });

      const result = getAlarmToSchedule(alarm, undefined, now);

      expect(result?.targetTimestampMs).toBe(now + 2 * intervalMs);
      expect(result?.skipNextOccurrence).toBe(false);
    });

    it("skips the next selected weekday occurrence", () => {
      const now = Date.now();
      const currentDay = new Date(now).getDay();
      const tomorrow = (currentDay + 1) % 7;
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(8, 0, 0, 0);
      const alarm = makeAlarm({
        targetTimestampMs: target.getTime(),
        repeat: { type: "weekdays", weekdays: [tomorrow] },
        skipNextOccurrence: true,
      });

      const result = getAlarmToSchedule(alarm, undefined, now);

      expect(result?.targetTimestampMs).toBeGreaterThan(
        target.getTime() + 6 * 24 * 60 * 60 * 1000,
      );
      expect(new Date(result!.targetTimestampMs).getDay()).toBe(tomorrow);
      expect(result?.skipNextOccurrence).toBe(false);
    });

    it("keeps a future snooze instead of replacing it with the recurrence", () => {
      const now = Date.now();
      const recurrenceAnchorTimestampMs = now - 10 * 60 * 1000;
      const targetTimestampMs = now + 5 * 60 * 1000;
      const alarm = makeAlarm({
        targetTimestampMs,
        recurrenceAnchorTimestampMs,
        repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      });

      expect(calculateNextAlarmTime(alarm, undefined, now)).toBe(
        targetTimestampMs,
      );
    });
  });

  describe("rescheduleAllEnabledAlarms", () => {
    it("should schedule only enabled alarms with future times", async () => {
      const futureTime = Date.now() + 3600000;
      const alarms = [
        makeAlarm({ id: "a1", enabled: true, targetTimestampMs: futureTime }),
        makeAlarm({ id: "a2", enabled: false, targetTimestampMs: futureTime }),
        makeAlarm({ id: "a3", enabled: true, targetTimestampMs: futureTime }),
      ];

      await rescheduleAllEnabledAlarms(alarms);

      expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
      const calls = (notifee.createTriggerNotification as jest.Mock).mock.calls;
      expect(calls[0][0].id).toBe("a1");
      expect(calls[1][0].id).toBe("a3");
    });

    it("should skip past alarms without repeat", async () => {
      const pastTime = Date.now() - 3600000;
      const alarms = [
        makeAlarm({
          id: "a1",
          enabled: true,
          targetTimestampMs: pastTime,
          repeat: null,
        }),
      ];

      await rescheduleAllEnabledAlarms(alarms);

      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("should reschedule repeating alarms with past target", async () => {
      const now = Date.now();
      const pastTime = now - 2 * 3600000;
      const alarms = [
        makeAlarm({
          id: "a1",
          enabled: true,
          targetTimestampMs: pastTime,
          repeat: { type: "interval", intervalMs: 3600000 },
        }),
      ];

      await rescheduleAllEnabledAlarms(alarms);

      expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
      const [notification, trigger] = (
        notifee.createTriggerNotification as jest.Mock
      ).mock.calls[0];
      expect(notification.id).toBe("a1");
      // The rescheduled timestamp should be in the future
      expect(trigger.timestamp).toBeGreaterThan(now);
    });

    it("should not fail when all alarms are past with no repeat", async () => {
      const pastTime = Date.now() - 3600000;
      const alarms = [
        makeAlarm({
          id: "a1",
          enabled: true,
          targetTimestampMs: pastTime,
          repeat: null,
        }),
        makeAlarm({
          id: "a2",
          enabled: true,
          targetTimestampMs: pastTime,
          repeat: null,
        }),
      ];

      await rescheduleAllEnabledAlarms(alarms);

      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("should handle empty alarm list", async () => {
      await rescheduleAllEnabledAlarms([]);
      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("should continue scheduling other alarms if one fails", async () => {
      const futureTime = Date.now() + 3600000;
      (notifee.createTriggerNotification as jest.Mock)
        .mockRejectedValueOnce(new Error("Schedule failed"))
        .mockResolvedValueOnce("trigger-id-2");

      const alarms = [
        makeAlarm({ id: "a1", enabled: true, targetTimestampMs: futureTime }),
        makeAlarm({ id: "a2", enabled: true, targetTimestampMs: futureTime }),
      ];

      await rescheduleAllEnabledAlarms(alarms);

      expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
    });

    it("uses the same next occurrence when rescheduled repeatedly", async () => {
      const now = Date.now();
      const alarm = makeAlarm({
        targetTimestampMs: now - 10 * 60 * 1000,
        repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      });

      await rescheduleAllEnabledAlarms([alarm]);
      await rescheduleAllEnabledAlarms([alarm]);

      const calls = (notifee.createTriggerNotification as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].id).toBe(calls[1][0].id);
      expect(calls[0][1].timestamp).toBe(calls[1][1].timestamp);
    });
  });

  describe("scheduleNextAlarmOccurrence", () => {
    it("schedules the next repeat after an alarm fires", async () => {
      const now = Date.now();
      const intervalMs = 60 * 60 * 1000;
      const alarm = makeAlarm({
        targetTimestampMs: now - 10 * 60 * 1000,
        repeat: { type: "interval", intervalMs },
      });

      const result = await scheduleNextAlarmOccurrence(alarm, undefined, now);

      expect(result.targetTimestampMs).toBe(now + 50 * 60 * 1000);
      expect(result.notifeeTriggerId).toBe("trigger-id");
      expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
    });

    it("returns to the original recurrence after a snooze fires", async () => {
      const now = Date.now();
      const recurrenceAnchorTimestampMs = now - 70 * 60 * 1000;
      const alarm = makeAlarm({
        targetTimestampMs: now - 10 * 60 * 1000,
        recurrenceAnchorTimestampMs,
        repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      });

      const result = await scheduleNextAlarmOccurrence(alarm, undefined, now);

      expect(result.targetTimestampMs).toBe(now + 50 * 60 * 1000);
      expect(result.recurrenceAnchorTimestampMs).toBeNull();
    });

    it("disables a one-shot alarm after it fires", async () => {
      const now = Date.now();
      const alarm = makeAlarm({
        targetTimestampMs: now - 10 * 60 * 1000,
        repeat: null,
      });

      const result = await scheduleNextAlarmOccurrence(alarm, undefined, now);

      expect(result.enabled).toBe(false);
      expect(result.notifeeTriggerId).toBeNull();
      expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    });

    it("does not return an unscheduled update when the next schedule fails", async () => {
      const now = Date.now();
      const alarm = makeAlarm({
        targetTimestampMs: now - 10 * 60 * 1000,
        repeat: { type: "interval", intervalMs: 60 * 60 * 1000 },
      });
      (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
        new Error("schedule failed"),
      );

      await expect(
        scheduleNextAlarmOccurrence(alarm, undefined, now),
      ).rejects.toThrow("schedule failed");
    });
  });
});
