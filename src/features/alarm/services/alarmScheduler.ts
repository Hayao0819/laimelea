import notifee, {
  TriggerType,
  AndroidCategory,
  type TimestampTrigger,
} from "@notifee/react-native";
import { ALARM_CHANNEL_ID } from "../../../core/notifications/notifeeSetup";
import type { Alarm } from "../../../models/Alarm";

export async function scheduleAlarm(alarm: Alarm): Promise<string> {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: alarm.targetTimestampMs,
    alarmManager: { allowWhileIdle: true },
  };

  const triggerId = await notifee.createTriggerNotification(
    {
      id: alarm.id,
      title: alarm.label || "Alarm",
      body: new Date(alarm.targetTimestampMs).toLocaleTimeString(),
      data: { alarmId: alarm.id },
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        fullScreenAction: {
          id: "alarm-fullscreen",
          launchActivity: "default",
        },
        pressAction: { id: "default" },
        loopSound: true,
        sound: "default",
        vibrationPattern: [300, 500, 200, 500],
        autoCancel: false,
        ongoing: true,
      },
    },
    trigger,
  );

  return triggerId;
}

export async function cancelAlarm(alarm: Alarm): Promise<void> {
  if (alarm.notifeeTriggerId) {
    await notifee.cancelTriggerNotification(alarm.notifeeTriggerId);
  }
  await notifee.cancelNotification(alarm.id);
}

export async function rescheduleAllAlarms(alarms: Alarm[]): Promise<void> {
  const enabledAlarms = alarms.filter((a) => a.enabled);
  for (const alarm of enabledAlarms) {
    await scheduleAlarm(alarm);
  }
}
