import notifee, {
  type TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";

import { TIMER_CHANNEL_ID } from "../../../core/notifications/notifeeSetup";

export async function showTimerCompleteNotification(
  label: string,
): Promise<void> {
  await notifee.displayNotification({
    title: label || "Timer",
    body: "Timer complete",
    android: {
      channelId: TIMER_CHANNEL_ID,
      sound: "default",
      vibrationPattern: [300, 500],
      autoCancel: true,
    },
  });
}

export async function scheduleTimerTrigger(timer: {
  id: string;
  label: string;
  durationMs: number;
  startedAt: number;
  pausedElapsedMs: number;
}): Promise<void> {
  const completionTime =
    timer.startedAt + timer.durationMs - timer.pausedElapsedMs;
  if (completionTime <= Date.now()) return;

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: completionTime,
    alarmManager: { allowWhileIdle: true },
  };

  try {
    await notifee.createTriggerNotification(
      {
        id: `timer-${timer.id}`,
        title: timer.label || "Timer",
        body: "Timer complete",
        android: {
          channelId: TIMER_CHANNEL_ID,
          sound: "default",
          vibrationPattern: [300, 500],
          autoCancel: true,
          pressAction: { id: "default" },
        },
      },
      trigger,
    );
  } catch (error) {
    console.warn("Failed to schedule timer trigger:", error);
  }
}

export async function cancelTimerTrigger(timerId: string): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(`timer-${timerId}`);
  } catch (error) {
    console.warn("Failed to cancel timer trigger:", error);
  }
}
