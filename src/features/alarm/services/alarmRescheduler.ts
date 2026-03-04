import type { Alarm } from "../../../models/Alarm";
import { scheduleAlarm } from "./alarmScheduler";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate the next alarm time for a repeating alarm.
 * Returns null if the alarm has no repeat and its target is in the past.
 */
export function calculateNextAlarmTime(alarm: Alarm): number | null {
  const now = Date.now();

  if (!alarm.repeat) {
    return alarm.targetTimestampMs > now ? alarm.targetTimestampMs : null;
  }

  switch (alarm.repeat.type) {
    case "weekdays": {
      const weekdays = alarm.repeat.weekdays;
      if (!weekdays || weekdays.length === 0) {
        return null;
      }
      return calculateNextWeekdayTime(alarm.targetTimestampMs, weekdays, now);
    }
    case "interval": {
      const intervalMs = alarm.repeat.intervalMs;
      if (!intervalMs || intervalMs <= 0) {
        return null;
      }
      return calculateNextIntervalTime(
        alarm.targetTimestampMs,
        intervalMs,
        now,
      );
    }
    case "customCycleInterval": {
      const cycleDays = alarm.repeat.customCycleIntervalDays;
      if (!cycleDays || cycleDays <= 0) {
        return null;
      }
      const intervalMs = cycleDays * MS_PER_DAY;
      return calculateNextIntervalTime(
        alarm.targetTimestampMs,
        intervalMs,
        now,
      );
    }
    default:
      return null;
  }
}

function calculateNextWeekdayTime(
  targetTimestampMs: number,
  weekdays: number[],
  now: number,
): number | null {
  const targetDate = new Date(targetTimestampMs);
  const targetHours = targetDate.getHours();
  const targetMinutes = targetDate.getMinutes();
  const targetSeconds = targetDate.getSeconds();
  const targetMilliseconds = targetDate.getMilliseconds();

  const nowDate = new Date(now);
  const currentDay = nowDate.getDay(); // 0=Sun, 6=Sat

  // Check each of the next 7 days (today through 6 days ahead)
  for (let offset = 0; offset < 7; offset++) {
    const candidateDay = (currentDay + offset) % 7;
    if (!weekdays.includes(candidateDay)) {
      continue;
    }

    const candidate = new Date(now);
    candidate.setDate(nowDate.getDate() + offset);
    candidate.setHours(
      targetHours,
      targetMinutes,
      targetSeconds,
      targetMilliseconds,
    );
    const candidateMs = candidate.getTime();

    if (candidateMs > now) {
      return candidateMs;
    }
  }

  // All candidate days this week are in the past; wrap to next week's first match
  const firstWeekday = weekdays
    .slice()
    .sort((a, b) => a - b)
    .find((d) => d >= 0);
  if (firstWeekday === undefined) {
    return null;
  }

  // Find the soonest matching weekday in the next full week
  for (let offset = 1; offset <= 7; offset++) {
    const candidateDay = (currentDay + offset) % 7;
    if (!weekdays.includes(candidateDay)) {
      continue;
    }

    const candidate = new Date(now);
    candidate.setDate(nowDate.getDate() + offset);
    candidate.setHours(
      targetHours,
      targetMinutes,
      targetSeconds,
      targetMilliseconds,
    );
    const candidateMs = candidate.getTime();

    if (candidateMs > now) {
      return candidateMs;
    }
  }

  return null;
}

function calculateNextIntervalTime(
  targetTimestampMs: number,
  intervalMs: number,
  now: number,
): number {
  if (targetTimestampMs > now) {
    return targetTimestampMs;
  }

  // Calculate how many intervals have passed and jump to the next one
  const elapsed = now - targetTimestampMs;
  const intervalsPassed = Math.floor(elapsed / intervalMs);
  const nextTime = targetTimestampMs + (intervalsPassed + 1) * intervalMs;
  return nextTime;
}

/**
 * Reschedule all enabled alarms that have a future fire time.
 * Each alarm is scheduled independently so one failure does not block others.
 */
export async function rescheduleAllEnabledAlarms(
  alarms: Alarm[],
): Promise<void> {
  const enabledAlarms = alarms.filter((a) => a.enabled);

  for (const alarm of enabledAlarms) {
    try {
      const nextTime = calculateNextAlarmTime(alarm);
      if (nextTime === null) {
        continue;
      }

      const alarmToSchedule: Alarm = {
        ...alarm,
        targetTimestampMs: nextTime,
      };
      await scheduleAlarm(alarmToSchedule);
    } catch {
      // Individual alarm failure should not prevent other alarms from being scheduled
    }
  }
}
