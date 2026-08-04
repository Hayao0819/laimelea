import { customToReal, realToCustom } from "../../../core/time/conversions";
import type { CycleConfig } from "../../../models/CustomTime";

const MS_PER_MINUTE = 60 * 1000;

export interface AlarmTimeOfDay {
  hours: number;
  minutes: number;
  seconds?: number;
}

export function getNextAlarmTimestamp(
  time: AlarmTimeOfDay,
  timeSystem: "custom" | "24h",
  cycleConfig: CycleConfig,
  now = Date.now(),
): number {
  if (timeSystem === "custom") {
    return getNextCustomTimestamp(time, cycleConfig, now);
  }
  return getNext24HourTimestamp(time, now);
}

export function getNextCustomTimestamp(
  time: AlarmTimeOfDay,
  cycleConfig: CycleConfig,
  now = Date.now(),
): number {
  const current = realToCustom(now, cycleConfig);
  const candidate = customToReal(
    {
      day: current.day,
      hours: time.hours,
      minutes: time.minutes,
      seconds: time.seconds ?? 0,
    },
    cycleConfig,
  );

  if (candidate > now) {
    return candidate;
  }

  return candidate + cycleConfig.cycleLengthMinutes * MS_PER_MINUTE;
}

export function getNext24HourTimestamp(
  time: AlarmTimeOfDay,
  now = Date.now(),
): number {
  const current = new Date(now);
  const candidate = new Date(now);
  candidate.setHours(time.hours, time.minutes, time.seconds ?? 0, 0);
  if (candidate.getTime() <= current.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}
