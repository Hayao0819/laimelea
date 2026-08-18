import notifee, {
  type TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getAlarmDeliveryStatus } from "../../../core/notifications/notifeeSetup";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import { DEFAULT_CYCLE_LENGTH_MINUTES } from "../../../core/time/constants";
import type { Alarm } from "../../../models/Alarm";
import type { CycleConfig } from "../../../models/CustomTime";
import { cancelAlarmAudio, scheduleAlarmAudio } from "./ringtoneService";

export type AlarmSchedulingFailure =
  | "notifications-disabled"
  | "exact-alarms-disabled";

export class AlarmSchedulingError extends Error {
  readonly failure: AlarmSchedulingFailure;

  constructor(failure: AlarmSchedulingFailure) {
    super(failure);
    this.name = "AlarmSchedulingError";
    this.failure = failure;
  }
}

async function getNativeRepeatIntervalMs(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
): Promise<number> {
  if (alarm.repeat?.type === "interval") {
    return Math.max(0, alarm.repeat.intervalMs ?? 0);
  }
  if (alarm.repeat?.type !== "customCycleInterval") {
    return 0;
  }
  if (cycleConfig) {
    return Math.max(
      0,
      (alarm.repeat.customCycleIntervalDays ?? 0) *
        cycleConfig.cycleLengthMinutes *
        60 *
        1000,
    );
  }
  try {
    const rawSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    const storedSettings = rawSettings
      ? (JSON.parse(rawSettings) as {
          cycleConfig?: { cycleLengthMinutes?: number };
        })
      : undefined;
    const cycleLengthMinutes =
      storedSettings?.cycleConfig?.cycleLengthMinutes ??
      DEFAULT_CYCLE_LENGTH_MINUTES;
    return Math.max(
      0,
      (alarm.repeat.customCycleIntervalDays ?? 0) *
        cycleLengthMinutes *
        60 *
        1000,
    );
  } catch {
    return (
      (alarm.repeat.customCycleIntervalDays ?? 0) *
      DEFAULT_CYCLE_LENGTH_MINUTES *
      60 *
      1000
    );
  }
}

export async function scheduleAlarm(
  alarm: Alarm,
  cycleConfig?: CycleConfig,
): Promise<string> {
  const deliveryStatus = await getAlarmDeliveryStatus();
  const useNativeAndroidDelivery = Platform.OS === "android";
  if (!useNativeAndroidDelivery && !deliveryStatus.notificationsEnabled) {
    throw new AlarmSchedulingError("notifications-disabled");
  }
  if (!deliveryStatus.exactAlarmsEnabled) {
    throw new AlarmSchedulingError("exact-alarms-disabled");
  }

  const timeoutAfter =
    alarm.autoSilenceMin > 0 ? alarm.autoSilenceMin * 60 * 1000 : undefined;
  let triggerId = alarm.id;
  if (!useNativeAndroidDelivery) {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: alarm.targetTimestampMs,
      alarmManager: { allowWhileIdle: true },
    };
    const sound = alarm.soundUri === "__silent__" ? undefined : "default";
    triggerId = await notifee.createTriggerNotification(
      {
        id: alarm.id,
        title: alarm.label || "Alarm",
        body: new Date(alarm.targetTimestampMs).toLocaleTimeString(),
        data: {
          alarmId: alarm.id,
          occurrenceTimestampMs: String(alarm.targetTimestampMs),
        },
        ios: {
          sound,
          foregroundPresentationOptions: {
            badge: true,
            banner: true,
            list: true,
            sound: sound !== undefined,
          },
        },
      },
      trigger,
    );
  } else {
    await notifee.cancelTriggerNotification(alarm.notifeeTriggerId ?? alarm.id);
  }

  try {
    if (useNativeAndroidDelivery) {
      await scheduleAlarmAudio(
        alarm.id,
        alarm.targetTimestampMs,
        alarm.soundUri,
        alarm.gradualVolumeDurationSec * 1000,
        timeoutAfter ?? 0,
        alarm.setInTimeSystem === "24h",
        alarm.repeat?.type ?? null,
        alarm.repeat?.weekdays ?? [],
        await getNativeRepeatIntervalMs(alarm, cycleConfig),
        alarm.label,
        alarm.vibrationEnabled,
      );
    }
  } catch (error) {
    if (!useNativeAndroidDelivery) {
      await notifee.cancelTriggerNotification(triggerId);
    }
    throw error;
  }

  return triggerId;
}

export async function cancelAlarm(alarm: Alarm): Promise<void> {
  const operations: Promise<unknown>[] = [notifee.cancelNotification(alarm.id)];
  if (Platform.OS === "android") {
    operations.push(cancelAlarmAudio(alarm.id));
  }
  const triggerId =
    alarm.notifeeTriggerId ?? (Platform.OS === "android" ? alarm.id : null);
  if (triggerId) {
    operations.push(notifee.cancelTriggerNotification(triggerId));
  }
  const results = await Promise.allSettled(operations);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) {
    throw failure.reason;
  }
}

export async function recoverAlarmSchedule(
  alarm: Alarm,
  now = Date.now(),
): Promise<Alarm> {
  try {
    const notifeeTriggerId = await scheduleAlarm(alarm);
    return { ...alarm, notifeeTriggerId };
  } catch {
    return {
      ...alarm,
      enabled: false,
      notifeeTriggerId: null,
      updatedAt: now,
    };
  }
}

export async function rescheduleAllAlarms(alarms: Alarm[]): Promise<void> {
  const enabledAlarms = alarms.filter((a) => a.enabled);
  for (const alarm of enabledAlarms) {
    await scheduleAlarm(alarm);
  }
}
