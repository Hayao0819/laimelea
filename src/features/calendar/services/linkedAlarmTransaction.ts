import type { Alarm } from "../../../models/Alarm";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import type { CycleConfig } from "../../../models/CustomTime";
import type { AppSettings } from "../../../models/Settings";
import {
  AlarmMutationError,
  replaceAlarmSchedule,
} from "../../alarm/services/alarmMutationService";
import {
  cancelAlarm,
  recoverAlarmSchedule,
} from "../../alarm/services/alarmScheduler";

export class LinkedAlarmTransactionError extends Error {
  constructor(
    readonly reason: "schedule-failed",
    readonly cause?: unknown,
    readonly recoveredAlarm?: Alarm,
  ) {
    super(reason);
    this.name = "LinkedAlarmTransactionError";
  }
}

export function createLinkedAlarm(
  event: CalendarEvent,
  settings: AppSettings,
  now = Date.now(),
): Alarm {
  const linkedEventOffsetMs = -settings.defaultEventReminderMin * 60 * 1000;
  const { alarmDefaults } = settings;
  return {
    id: `alarm-${now}-${Math.random().toString(36).slice(2, 8)}`,
    label: event.title,
    enabled: true,
    targetTimestampMs: event.startTimestampMs + linkedEventOffsetMs,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: alarmDefaults.dismissalMethod,
    gradualVolumeDurationSec: alarmDefaults.gradualVolumeDurationSec,
    snoozeDurationMin: alarmDefaults.snoozeDurationMin,
    snoozeMaxCount: alarmDefaults.snoozeMaxCount,
    snoozeCount: 0,
    autoSilenceMin: 10,
    soundUri: null,
    vibrationEnabled: alarmDefaults.vibrationEnabled,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: event.id,
    linkedCalendarSourceEventId: event.sourceEventId,
    linkedEventOffsetMs,
    mathDifficulty: alarmDefaults.mathDifficulty,
    lastFiredAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function rescheduleLinkedAlarm(
  alarm: Alarm,
  targetTimestampMs: number,
  cycleConfig?: CycleConfig,
): Promise<Alarm> {
  if (targetTimestampMs <= Date.now()) {
    try {
      await cancelAlarm(alarm);
    } catch (error) {
      const recoveredAlarm = await recoverAlarmSchedule(
        alarm,
        Date.now(),
        cycleConfig,
      );
      throw new LinkedAlarmTransactionError(
        "schedule-failed",
        error,
        recoveredAlarm,
      );
    }
    return {
      ...alarm,
      enabled: false,
      targetTimestampMs,
      notifeeTriggerId: null,
      updatedAt: Date.now(),
    };
  }

  const updatedAlarm: Alarm = {
    ...alarm,
    targetTimestampMs,
    notifeeTriggerId: null,
    updatedAt: Date.now(),
  };

  try {
    return await replaceAlarmSchedule(alarm, updatedAlarm, cycleConfig);
  } catch (error) {
    throw new LinkedAlarmTransactionError(
      "schedule-failed",
      error,
      error instanceof AlarmMutationError ? error.recoveredAlarm : undefined,
    );
  }
}
