import notifee, {
  AndroidCategory,
  type TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";

import {
  createAlarmDeliveryChannel,
  getAlarmDeliveryStatus,
} from "../../../core/notifications/notifeeSetup";
import type { Alarm } from "../../../models/Alarm";
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

export async function scheduleAlarm(alarm: Alarm): Promise<string> {
  const deliveryStatus = await getAlarmDeliveryStatus();
  if (!deliveryStatus.notificationsEnabled) {
    throw new AlarmSchedulingError("notifications-disabled");
  }
  if (!deliveryStatus.exactAlarmsEnabled) {
    throw new AlarmSchedulingError("exact-alarms-disabled");
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: alarm.targetTimestampMs,
    alarmManager: { allowWhileIdle: true },
  };

  const channelId = await createAlarmDeliveryChannel(alarm.vibrationEnabled);
  const timeoutAfter =
    alarm.autoSilenceMin > 0 ? alarm.autoSilenceMin * 60 * 1000 : undefined;

  const triggerId = await notifee.createTriggerNotification(
    {
      id: alarm.id,
      title: alarm.label || "Alarm",
      body: new Date(alarm.targetTimestampMs).toLocaleTimeString(),
      data: {
        alarmId: alarm.id,
        occurrenceTimestampMs: String(alarm.targetTimestampMs),
      },
      android: {
        channelId,
        category: AndroidCategory.ALARM,
        fullScreenAction: deliveryStatus.fullScreenIntentEnabled
          ? {
              id: "alarm-fullscreen",
              launchActivity: "default",
            }
          : undefined,
        pressAction: { id: "default" },
        loopSound: false,
        timeoutAfter,
        autoCancel: false,
        ongoing: true,
      },
    },
    trigger,
  );

  try {
    if (alarm.soundUri === "__silent__") {
      await cancelAlarmAudio(alarm.id);
    } else {
      await scheduleAlarmAudio(
        alarm.id,
        alarm.targetTimestampMs,
        alarm.soundUri,
        alarm.gradualVolumeDurationSec * 1000,
        timeoutAfter ?? 0,
      );
    }
  } catch (error) {
    await notifee.cancelTriggerNotification(triggerId);
    throw error;
  }

  return triggerId;
}

export async function cancelAlarm(alarm: Alarm): Promise<void> {
  const operations: Promise<unknown>[] = [
    cancelAlarmAudio(alarm.id),
    notifee.cancelNotification(alarm.id),
  ];
  if (alarm.notifeeTriggerId) {
    operations.push(notifee.cancelTriggerNotification(alarm.notifeeTriggerId));
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
