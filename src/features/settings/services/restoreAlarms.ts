import type { Alarm } from "../../../models/Alarm";
import type { CycleConfig } from "../../../models/CustomTime";
import { getAlarmToSchedule } from "../../alarm/services/alarmRescheduler";
import {
  cancelAlarm,
  scheduleAlarm,
} from "../../alarm/services/alarmScheduler";

export class AlarmRestoreError extends Error {
  constructor(readonly recoveredAlarms: Alarm[]) {
    super("Unable to restore alarm schedules");
    this.name = "AlarmRestoreError";
  }
}

async function recoverAlarms(
  alarms: Alarm[],
  cycleConfig: CycleConfig,
  now: number,
): Promise<Alarm[]> {
  const recovered: Alarm[] = [];
  for (const alarm of alarms) {
    if (alarm.enabled || alarm.notifeeTriggerId) {
      try {
        await cancelAlarm(alarm);
      } catch {
        recovered.push(alarm);
        continue;
      }
    }
    if (!alarm.enabled) {
      recovered.push({ ...alarm, notifeeTriggerId: null });
      continue;
    }
    const alarmToSchedule = getAlarmToSchedule(alarm, cycleConfig, now);
    if (!alarmToSchedule) {
      recovered.push({
        ...alarm,
        enabled: false,
        notifeeTriggerId: null,
        skipNextOccurrence: false,
        updatedAt: now,
      });
      continue;
    }
    try {
      const notifeeTriggerId = await scheduleAlarm(
        alarmToSchedule,
        cycleConfig,
      );
      recovered.push({ ...alarmToSchedule, notifeeTriggerId, updatedAt: now });
    } catch {
      recovered.push({ ...alarm, enabled: false, notifeeTriggerId: null });
    }
  }
  return recovered;
}

async function cancelAlarms(alarms: Alarm[]): Promise<void> {
  for (const alarm of alarms) {
    if (alarm.enabled || alarm.notifeeTriggerId) {
      await cancelAlarm(alarm);
    }
  }
}

export async function restoreAlarmSchedules(
  currentAlarms: Alarm[],
  restoredAlarms: Alarm[],
  currentCycleConfig: CycleConfig,
  restoredCycleConfig: CycleConfig,
): Promise<Alarm[]> {
  const now = Date.now();
  try {
    await cancelAlarms(currentAlarms);
  } catch {
    throw new AlarmRestoreError(
      await recoverAlarms(currentAlarms, currentCycleConfig, now),
    );
  }

  const scheduled: Alarm[] = [];
  try {
    for (const alarm of restoredAlarms) {
      if (!alarm.enabled) {
        scheduled.push({ ...alarm, notifeeTriggerId: null });
        continue;
      }
      const alarmToSchedule = getAlarmToSchedule(
        alarm,
        restoredCycleConfig,
        now,
      );
      if (!alarmToSchedule) {
        scheduled.push({
          ...alarm,
          enabled: false,
          notifeeTriggerId: null,
          skipNextOccurrence: false,
          updatedAt: now,
        });
        continue;
      }
      const notifeeTriggerId = await scheduleAlarm(
        alarmToSchedule,
        restoredCycleConfig,
      );
      scheduled.push({ ...alarmToSchedule, notifeeTriggerId, updatedAt: now });
    }
    return scheduled;
  } catch {
    await Promise.allSettled(scheduled.map((alarm) => cancelAlarm(alarm)));
    throw new AlarmRestoreError(
      await recoverAlarms(currentAlarms, currentCycleConfig, now),
    );
  }
}
