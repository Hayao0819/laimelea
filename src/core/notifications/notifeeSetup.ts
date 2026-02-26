import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from "@notifee/react-native";

const ALARM_CHANNEL_ID = "alarm";
const TIMER_CHANNEL_ID = "timer";

export async function createAlarmChannel(): Promise<string> {
  return notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: "Alarms",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
  });
}

export async function createTimerChannel(): Promise<string> {
  return notifee.createChannel({
    id: TIMER_CHANNEL_ID,
    name: "Timers",
    importance: AndroidImportance.DEFAULT,
    sound: "default",
    vibration: true,
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export { ALARM_CHANNEL_ID, TIMER_CHANNEL_ID };
