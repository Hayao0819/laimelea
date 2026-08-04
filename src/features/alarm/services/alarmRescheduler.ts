import type { Alarm } from "../../../models/Alarm";
import type { CycleConfig } from "../../../models/CustomTime";
import { scheduleAlarm } from "./alarmScheduler";

const DEFAULT_CYCLE_LENGTH_MINUTES = 24 * 60;

export function calculateNextAlarmTime(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
  now = Date.now(),
): number | null {
  if (
    alarm.recurrenceAnchorTimestampMs != null &&
    alarm.targetTimestampMs > now
  ) {
    return alarm.targetTimestampMs;
  }

  if (!alarm.repeat) {
    return alarm.targetTimestampMs > now ? alarm.targetTimestampMs : null;
  }

  const recurrenceAnchorTimestampMs =
    alarm.recurrenceAnchorTimestampMs ?? alarm.targetTimestampMs;

  switch (alarm.repeat.type) {
    case "weekdays": {
      const weekdays = alarm.repeat.weekdays;
      if (!weekdays || weekdays.length === 0) {
        return null;
      }
      return calculateNextWeekdayTime(
        recurrenceAnchorTimestampMs,
        weekdays,
        now,
      );
    }
    case "interval": {
      const intervalMs = alarm.repeat.intervalMs;
      if (!intervalMs || intervalMs <= 0) {
        return null;
      }
      return calculateNextIntervalTime(
        recurrenceAnchorTimestampMs,
        intervalMs,
        now,
      );
    }
    case "customCycleInterval": {
      const cycleDays = alarm.repeat.customCycleIntervalDays;
      if (!cycleDays || cycleDays <= 0) {
        return null;
      }
      const intervalMs =
        cycleDays *
        (cycleConfig?.cycleLengthMinutes ?? DEFAULT_CYCLE_LENGTH_MINUTES) *
        60 *
        1000;
      return calculateNextIntervalTime(
        recurrenceAnchorTimestampMs,
        intervalMs,
        now,
      );
    }
    default:
      return null;
  }
}

export function getAlarmToSchedule(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
  now = Date.now(),
): Alarm | null {
  const nextTime = calculateNextAlarmTime(alarm, cycleConfig, now);
  if (nextTime === null) {
    return null;
  }

  const scheduledTime = alarm.skipNextOccurrence
    ? calculateNextAlarmTime(
        { ...alarm, targetTimestampMs: nextTime },
        cycleConfig,
        nextTime,
      )
    : nextTime;

  if (scheduledTime === null) {
    return null;
  }

  return {
    ...alarm,
    targetTimestampMs: scheduledTime,
    recurrenceAnchorTimestampMs: null,
    skipNextOccurrence: false,
  };
}

export async function scheduleNextAlarmOccurrence(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
  now = Date.now(),
): Promise<Alarm> {
  const alarmToSchedule = getAlarmToSchedule(alarm, cycleConfig, now);
  if (alarmToSchedule === null) {
    return {
      ...alarm,
      enabled: false,
      notifeeTriggerId: null,
      skipNextOccurrence: false,
      updatedAt: now,
    };
  }

  const triggerId = await scheduleAlarm(alarmToSchedule);
  return {
    ...alarmToSchedule,
    notifeeTriggerId: triggerId,
    updatedAt: now,
  };
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

  const firstWeekday = weekdays
    .slice()
    .sort((a, b) => a - b)
    .find((d) => d >= 0);
  if (firstWeekday === undefined) {
    return null;
  }

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

  const elapsed = now - targetTimestampMs;
  const intervalsPassed = Math.floor(elapsed / intervalMs);
  const nextTime = targetTimestampMs + (intervalsPassed + 1) * intervalMs;
  return nextTime;
}

export async function rescheduleAllEnabledAlarms(
  alarms: Alarm[],
  cycleConfig?: CycleConfig,
): Promise<Alarm[]> {
  const now = Date.now();
  const updatedAlarms: Alarm[] = [];

  for (const alarm of alarms) {
    if (!alarm.enabled) {
      updatedAlarms.push(alarm);
      continue;
    }
    try {
      const alarmToSchedule = getAlarmToSchedule(alarm, cycleConfig, now);
      if (alarmToSchedule === null) {
        updatedAlarms.push({
          ...alarm,
          enabled: false,
          notifeeTriggerId: null,
          skipNextOccurrence: false,
          updatedAt: now,
        });
        continue;
      }
      const triggerId = await scheduleAlarm(alarmToSchedule);
      updatedAlarms.push({
        ...alarmToSchedule,
        notifeeTriggerId: triggerId,
        updatedAt:
          alarmToSchedule.targetTimestampMs === alarm.targetTimestampMs &&
          alarmToSchedule.skipNextOccurrence === alarm.skipNextOccurrence &&
          alarm.notifeeTriggerId === triggerId
            ? alarm.updatedAt
            : now,
      });
    } catch {
      updatedAlarms.push(alarm);
    }
  }

  return updatedAlarms;
}
