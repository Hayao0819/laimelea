import type { Alarm, BulkAlarmParams } from "../../../models/Alarm";
import type { CycleConfig } from "../../../models/CustomTime";
import type { AlarmDefaults } from "../../../models/Settings";
import { getNextAlarmTimestamp } from "./alarmTime";

export const ANDROID_ALARM_TRIGGER_LIMIT = 50;

export interface BulkAlarmResult {
  alarms: Alarm[];
  warning: string | null;
  limitExceeded: boolean;
}

function generateTimeSlots(
  fromMinutes: number,
  toMinutes: number,
  intervalMinutes: number,
  maxMinutes: number,
): number[] {
  if (intervalMinutes <= 0) return [];

  if (fromMinutes === toMinutes) {
    return [fromMinutes];
  }

  const slots: number[] = [];
  const range =
    toMinutes > fromMinutes
      ? toMinutes - fromMinutes
      : maxMinutes - fromMinutes + toMinutes;

  for (let offset = 0; offset <= range; offset += intervalMinutes) {
    slots.push((fromMinutes + offset) % maxMinutes);
  }

  return slots;
}

function slotToTimestamp(
  minutes: number,
  timeSystem: "custom" | "24h",
  cycleConfig: CycleConfig,
  now: number,
): number {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return getNextAlarmTimestamp(
    { hours, minutes: mins },
    timeSystem,
    cycleConfig,
    now,
  );
}

export function generateBulkAlarms(
  params: BulkAlarmParams,
  cycleConfig: CycleConfig,
  defaults: AlarmDefaults,
  existingEnabledAlarmCount: number,
): BulkAlarmResult {
  const maxMinutes =
    params.timeSystem === "custom" ? cycleConfig.cycleLengthMinutes : 1440;

  const fromMinutes = params.fromHour * 60 + params.fromMinute;
  const toMinutes = params.toHour * 60 + params.toMinute;

  const slots = generateTimeSlots(
    fromMinutes,
    toMinutes,
    params.intervalMinutes,
    maxMinutes,
  );

  const now = Date.now();

  const alarms: Alarm[] = slots.map((slotMinutes, index) => ({
    id: `bulk-${now}-${index}`,
    label: params.label,
    enabled: true,
    targetTimestampMs: slotToTimestamp(
      slotMinutes,
      params.timeSystem,
      cycleConfig,
      now,
    ),
    setInTimeSystem: params.timeSystem,
    repeat: null,
    dismissalMethod: params.dismissalMethod,
    gradualVolumeDurationSec: params.gradualVolumeDurationSec,
    snoozeDurationMin: params.snoozeDurationMin,
    snoozeMaxCount: params.snoozeMaxCount,
    snoozeCount: 0,
    autoSilenceMin: 15,
    soundUri: null,
    vibrationEnabled: defaults.vibrationEnabled,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: params.mathDifficulty,
    lastFiredAt: null,
    createdAt: now,
    updatedAt: now,
  }));

  const totalCount = existingEnabledAlarmCount + alarms.length;
  const limitExceeded = totalCount > ANDROID_ALARM_TRIGGER_LIMIT;
  const warning = limitExceeded ? `alarm.bulkWarningLimit` : null;

  return { alarms, warning, limitExceeded };
}
