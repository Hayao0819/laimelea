import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from "@notifee/react-native";

const ALARM_CHANNEL_ID = "alarm";

export async function createAlarmChannel(): Promise<string> {
  return notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: "Alarms",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export { ALARM_CHANNEL_ID };
