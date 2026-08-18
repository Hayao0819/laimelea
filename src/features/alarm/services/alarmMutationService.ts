import type { Alarm } from "../../../models/Alarm";
import type { CycleConfig } from "../../../models/CustomTime";
import { getAlarmToSchedule } from "./alarmRescheduler";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "./alarmScheduler";

export type AlarmMutationFailure =
  | "no-next-occurrence"
  | "cancel-failed"
  | "schedule-failed";

export class AlarmMutationError extends Error {
  constructor(
    readonly failure: AlarmMutationFailure,
    readonly recoveredAlarm?: Alarm,
    readonly cause?: unknown,
    readonly retainedAlarms: Alarm[] = [],
  ) {
    super(failure);
    this.name = "AlarmMutationError";
  }
}

export async function scheduleAlarmRecord(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
): Promise<Alarm> {
  try {
    const notifeeTriggerId = cycleConfig
      ? await scheduleAlarm(alarm, cycleConfig)
      : await scheduleAlarm(alarm);
    return { ...alarm, notifeeTriggerId };
  } catch (error) {
    throw new AlarmMutationError("schedule-failed", undefined, error);
  }
}

async function cancelOrRecover(
  alarm: Alarm,
  cycleConfig: CycleConfig | undefined,
  now: number,
): Promise<void> {
  try {
    await cancelAlarm(alarm);
  } catch (error) {
    const recoveredAlarm = await recoverAlarmSchedule(alarm, now, cycleConfig);
    throw new AlarmMutationError("cancel-failed", recoveredAlarm, error);
  }
}

export async function replaceAlarmSchedule(
  previousAlarm: Alarm,
  nextAlarm: Alarm,
  cycleConfig?: CycleConfig,
  now = Date.now(),
): Promise<Alarm> {
  await cancelOrRecover(previousAlarm, cycleConfig, now);
  try {
    return await scheduleAlarmRecord(nextAlarm, cycleConfig);
  } catch (error) {
    const recoveredAlarm = await recoverAlarmSchedule(
      previousAlarm,
      now,
      cycleConfig,
    );
    throw new AlarmMutationError("schedule-failed", recoveredAlarm, error);
  }
}

export async function setAlarmEnabled(
  alarm: Alarm,
  enabled: boolean,
  cycleConfig: CycleConfig,
  now = Date.now(),
): Promise<Alarm> {
  if (!enabled) {
    await cancelOrRecover(alarm, cycleConfig, now);
    return {
      ...alarm,
      enabled: false,
      notifeeTriggerId: null,
      updatedAt: now,
    };
  }

  const alarmToSchedule = getAlarmToSchedule(
    { ...alarm, enabled: true, updatedAt: now },
    cycleConfig,
    now,
  );
  if (alarmToSchedule == null) {
    throw new AlarmMutationError("no-next-occurrence");
  }
  return {
    ...(await scheduleAlarmRecord(alarmToSchedule, cycleConfig)),
    updatedAt: now,
  };
}

export async function skipNextAlarmOccurrence(
  alarm: Alarm,
  cycleConfig: CycleConfig,
  now = Date.now(),
): Promise<Alarm> {
  const alarmToSchedule = getAlarmToSchedule(
    { ...alarm, skipNextOccurrence: true },
    cycleConfig,
    now,
  );
  if (alarmToSchedule == null) {
    throw new AlarmMutationError("no-next-occurrence");
  }

  await cancelOrRecover(alarm, cycleConfig, now);
  try {
    return {
      ...(await scheduleAlarmRecord(alarmToSchedule, cycleConfig)),
      updatedAt: now,
    };
  } catch (error) {
    const recoveredAlarm = await recoverAlarmSchedule(alarm, now, cycleConfig);
    throw new AlarmMutationError("schedule-failed", recoveredAlarm, error);
  }
}

export async function deleteAlarmSchedule(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
  now = Date.now(),
): Promise<void> {
  await cancelOrRecover(alarm, cycleConfig, now);
}

export async function scheduleAlarmBatch(
  alarms: Alarm[],
  cycleConfig?: CycleConfig,
): Promise<Alarm[]> {
  const scheduledAlarms: Alarm[] = [];
  const rollbackAlarms: Alarm[] = [];
  try {
    for (const alarm of alarms) {
      rollbackAlarms.push(alarm);
      const scheduledAlarm = await scheduleAlarmRecord(alarm, cycleConfig);
      rollbackAlarms[rollbackAlarms.length - 1] = scheduledAlarm;
      scheduledAlarms.push(scheduledAlarm);
    }
    return scheduledAlarms;
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      rollbackAlarms.map((alarm) => cancelAlarm(alarm)),
    );
    const retainedAlarms = rollbackAlarms.filter(
      (_alarm, index) => rollbackResults[index].status === "rejected",
    );
    if (error instanceof AlarmMutationError) {
      throw new AlarmMutationError(
        error.failure,
        error.recoveredAlarm,
        error.cause,
        retainedAlarms,
      );
    }
    throw new AlarmMutationError(
      "schedule-failed",
      undefined,
      error,
      retainedAlarms,
    );
  }
}
