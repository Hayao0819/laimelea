import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import {
  readStoredAlarms,
  readStoredSettings,
} from "../../../core/storage/storedAppState";
import type { Alarm } from "../../../models/Alarm";
import { scheduleNextAlarmOccurrence } from "./alarmRescheduler";

export interface AlarmDeliveryData {
  alarmId?: unknown;
  occurrenceTimestampMs?: unknown;
  autoSilenceMs?: unknown;
  stopped?: unknown;
}

export interface AlarmDeliveryResult {
  handled: boolean;
  alarms: Alarm[] | null;
  updatedAlarm: Alarm | null;
  rescheduleFailed: boolean;
}

export type AlarmDeliveryUpdateHandler = (alarms: Alarm[]) => void;

let deliveryQueue: Promise<void> = Promise.resolve();

function enqueueDelivery<T>(task: () => Promise<T>): Promise<T> {
  const result = deliveryQueue.then(task, task);
  deliveryQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseOccurrenceTimestamp(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clearStoppedAlarm(
  alarms: Alarm[],
  alarmIndex: number,
): { alarms: Alarm[]; updatedAlarm: Alarm | null } {
  const alarm = alarms[alarmIndex];
  if (alarm.isTest) {
    return {
      alarms: alarms.filter((_, index) => index !== alarmIndex),
      updatedAlarm: null,
    };
  }
  const updatedAlarm = { ...alarm, activeOccurrenceTimestampMs: null };
  return {
    alarms: alarms.map((storedAlarm, index) =>
      index === alarmIndex ? updatedAlarm : storedAlarm,
    ),
    updatedAlarm,
  };
}

async function processAlarmDeliveryInternal(
  data: AlarmDeliveryData | undefined,
  now: number,
): Promise<AlarmDeliveryResult> {
  if (typeof data?.alarmId !== "string") {
    return {
      handled: false,
      alarms: null,
      updatedAlarm: null,
      rescheduleFailed: false,
    };
  }

  const [alarms, settings] = await Promise.all([
    readStoredAlarms(),
    readStoredSettings(),
  ]);
  if (!alarms) {
    return {
      handled: false,
      alarms: null,
      updatedAlarm: null,
      rescheduleFailed: false,
    };
  }

  const alarmIndex = alarms.findIndex((alarm) => alarm.id === data.alarmId);
  if (alarmIndex < 0) {
    return {
      handled: false,
      alarms,
      updatedAlarm: null,
      rescheduleFailed: false,
    };
  }

  const alarm = alarms[alarmIndex];
  const suppliedOccurrenceTimestampMs = parseOccurrenceTimestamp(
    data.occurrenceTimestampMs,
  );
  if (!alarm.enabled) {
    if (
      data.stopped === true &&
      suppliedOccurrenceTimestampMs != null &&
      alarm.activeOccurrenceTimestampMs === suppliedOccurrenceTimestampMs
    ) {
      const stoppedAlarm = clearStoppedAlarm(alarms, alarmIndex);
      await AsyncStorage.setItem(
        STORAGE_KEYS.ALARMS,
        JSON.stringify(stoppedAlarm.alarms),
      );
      return {
        handled: true,
        ...stoppedAlarm,
        rescheduleFailed: false,
      };
    }
    return {
      handled: false,
      alarms,
      updatedAlarm: alarm,
      rescheduleFailed: false,
    };
  }
  const occurrenceTimestampMs =
    suppliedOccurrenceTimestampMs ??
    alarm.activeOccurrenceTimestampMs ??
    alarm.targetTimestampMs;

  if (alarm.lastDeliveredOccurrenceTimestampMs === occurrenceTimestampMs) {
    if (
      data.stopped === true &&
      alarm.activeOccurrenceTimestampMs === occurrenceTimestampMs
    ) {
      const stoppedAlarm = clearStoppedAlarm(alarms, alarmIndex);
      await AsyncStorage.setItem(
        STORAGE_KEYS.ALARMS,
        JSON.stringify(stoppedAlarm.alarms),
      );
      return {
        handled: true,
        ...stoppedAlarm,
        rescheduleFailed: false,
      };
    }
    return {
      handled: false,
      alarms,
      updatedAlarm: alarm,
      rescheduleFailed: false,
    };
  }
  if (
    suppliedOccurrenceTimestampMs != null &&
    suppliedOccurrenceTimestampMs !== alarm.targetTimestampMs &&
    suppliedOccurrenceTimestampMs !== alarm.activeOccurrenceTimestampMs
  ) {
    return {
      handled: false,
      alarms,
      updatedAlarm: alarm,
      rescheduleFailed: false,
    };
  }

  const deliveredAlarm: Alarm = {
    ...alarm,
    targetTimestampMs: occurrenceTimestampMs,
  };
  if (deliveredAlarm.isTest) {
    const autoSilenceMs = parseOccurrenceTimestamp(data.autoSilenceMs) ?? 0;
    const shouldDiscard =
      data.stopped === true ||
      (autoSilenceMs > 0 && now >= occurrenceTimestampMs + autoSilenceMs);
    const updatedTestAlarm: Alarm = {
      ...deliveredAlarm,
      activeOccurrenceTimestampMs: occurrenceTimestampMs,
      lastDeliveredOccurrenceTimestampMs: occurrenceTimestampMs,
    };
    const updatedAlarms = shouldDiscard
      ? alarms.filter((_, index) => index !== alarmIndex)
      : alarms.map((storedAlarm, index) =>
          index === alarmIndex ? updatedTestAlarm : storedAlarm,
        );
    await AsyncStorage.setItem(
      STORAGE_KEYS.ALARMS,
      JSON.stringify(updatedAlarms),
    );
    return {
      handled: true,
      alarms: updatedAlarms,
      updatedAlarm: shouldDiscard ? null : updatedTestAlarm,
      rescheduleFailed: false,
    };
  }
  let nextAlarm: Alarm;
  let rescheduleFailed = false;
  try {
    nextAlarm = await scheduleNextAlarmOccurrence(
      deliveredAlarm,
      settings.cycleConfig,
      Math.max(now, occurrenceTimestampMs),
    );
  } catch {
    rescheduleFailed = true;
    nextAlarm = {
      ...deliveredAlarm,
      enabled: false,
      notifeeTriggerId: null,
      updatedAt: now,
    };
  }
  const autoSilenceMs = parseOccurrenceTimestamp(data.autoSilenceMs) ?? 0;
  const deliveryExpired =
    autoSilenceMs > 0 && now >= occurrenceTimestampMs + autoSilenceMs;
  const updatedAlarm: Alarm = {
    ...nextAlarm,
    activeOccurrenceTimestampMs:
      data.stopped === true || deliveryExpired ? null : occurrenceTimestampMs,
    lastDeliveredOccurrenceTimestampMs: occurrenceTimestampMs,
  };
  const updatedAlarms = alarms.map((storedAlarm, index) =>
    index === alarmIndex ? updatedAlarm : storedAlarm,
  );

  await AsyncStorage.setItem(
    STORAGE_KEYS.ALARMS,
    JSON.stringify(updatedAlarms),
  );
  return {
    handled: true,
    alarms: updatedAlarms,
    updatedAlarm,
    rescheduleFailed,
  };
}

export async function processAlarmDelivery(
  data: AlarmDeliveryData | undefined,
  onAlarmsUpdated?: AlarmDeliveryUpdateHandler,
  now = Date.now(),
): Promise<AlarmDeliveryResult> {
  return enqueueDelivery(async () => {
    const result = await processAlarmDeliveryInternal(data, now);
    if (result.handled && result.alarms) {
      onAlarmsUpdated?.(result.alarms);
    }
    return result;
  });
}
