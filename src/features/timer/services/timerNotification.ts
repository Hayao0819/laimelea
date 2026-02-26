import notifee from "@notifee/react-native";
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
