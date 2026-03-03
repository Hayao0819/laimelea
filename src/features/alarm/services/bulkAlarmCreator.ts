import { customToReal } from "../../../core/time/conversions";
import type { Alarm, BulkAlarmParams } from "../../../models/Alarm";
import type { CycleConfig } from "../../../models/CustomTime";
import type { AlarmDefaults } from "../../../models/Settings";

export const ANDROID_ALARM_TRIGGER_LIMIT = 50;

export interface BulkAlarmResult {
  alarms: Alarm[];
  warning: string | null;
}

/**
 * Generate time slots (in minutes from cycle/day start) between from and to
 * with the given interval. Handles wraparound when to <= from.
 */
function generateTimeSlots(
  fromMinutes: number,
  toMinutes: number,
  intervalMinutes: number,
  maxMinutes: number,
): number[] {
  if (intervalMinutes <= 0) return [];

  // from == to means exactly one alarm at that time
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

/**
 * Convert a time slot (minutes from start) to a real timestamp.
 * If the computed timestamp is in the past, advance by one cycle/day.
 */
function slotToTimestamp(
  minutes: number,
  timeSystem: "custom" | "24h",
  cycleConfig: CycleConfig,
): number {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (timeSystem === "custom") {
    const ts = customToReal(
      { day: 0, hours, minutes: mins, seconds: 0 },
      cycleConfig,
    );
    if (ts <= Date.now()) {
      const cycleLengthMs = cycleConfig.cycleLengthMinutes * 60 * 1000;
      return ts + cycleLengthMs;
    }
    return ts;
  }

  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, mins, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

/**
 * Generate multiple alarms from bulk parameters.
 * Pure function - does not schedule alarms (caller is responsible for that).
 */
export function generateBulkAlarms(
  params: BulkAlarmParams,
  cycleConfig: CycleConfig,
  defaults: AlarmDefaults,
  existingAlarmCount: number,
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

  const totalCount = existingAlarmCount + alarms.length;
  const warning =
    totalCount >= ANDROID_ALARM_TRIGGER_LIMIT ? `alarm.bulkWarningLimit` : null;

  return { alarms, warning };
}
