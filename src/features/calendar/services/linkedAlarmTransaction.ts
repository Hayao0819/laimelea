import type { Alarm } from "../../../models/Alarm";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../../alarm/services/alarmScheduler";

export class LinkedAlarmTransactionError extends Error {
  constructor(
    readonly reason: "past" | "schedule-failed",
    readonly cause?: unknown,
    readonly recoveredAlarm?: Alarm,
  ) {
    super(reason);
    this.name = "LinkedAlarmTransactionError";
  }
}

export async function scheduleNewLinkedAlarm(alarm: Alarm): Promise<Alarm> {
  if (alarm.targetTimestampMs <= Date.now()) {
    throw new LinkedAlarmTransactionError("past");
  }

  try {
    const notifeeTriggerId = await scheduleAlarm(alarm);
    return { ...alarm, notifeeTriggerId };
  } catch (error) {
    throw new LinkedAlarmTransactionError("schedule-failed", error);
  }
}

export async function rescheduleLinkedAlarm(
  alarm: Alarm,
  targetTimestampMs: number,
): Promise<Alarm> {
  if (targetTimestampMs <= Date.now()) {
    try {
      await cancelAlarm(alarm);
    } catch (error) {
      const recoveredAlarm = await recoverAlarmSchedule(alarm);
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
    await cancelAlarm(alarm);
  } catch (error) {
    const recoveredAlarm = await recoverAlarmSchedule(alarm);
    throw new LinkedAlarmTransactionError(
      "schedule-failed",
      error,
      recoveredAlarm,
    );
  }

  try {
    const notifeeTriggerId = await scheduleAlarm(updatedAlarm);
    return { ...updatedAlarm, notifeeTriggerId };
  } catch (error) {
    const recoveredAlarm = await recoverAlarmSchedule(alarm);
    throw new LinkedAlarmTransactionError(
      "schedule-failed",
      error,
      recoveredAlarm,
    );
  }
}
