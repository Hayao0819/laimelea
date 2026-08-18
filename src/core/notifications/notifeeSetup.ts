import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
} from "@notifee/react-native";
import { NativeModules, Platform } from "react-native";

const ALARM_CHANNEL_ID = "alarm";
const TIMER_CHANNEL_ID = "timer";

export interface AlarmDeliveryStatus {
  notificationsEnabled: boolean;
  exactAlarmsEnabled: boolean;
  fullScreenIntentEnabled: boolean;
}

interface AlarmCapabilityModule {
  getAlarmCapabilities(): Promise<{
    canScheduleExactAlarms: boolean;
    canUseFullScreenIntent: boolean;
  }>;
  openFullScreenIntentSettings(): Promise<void>;
}

function getRingtoneCapabilityModule():
  | Partial<AlarmCapabilityModule>
  | undefined {
  const nativeModules = NativeModules as {
    RingtoneModule?: Partial<AlarmCapabilityModule>;
  };
  return nativeModules.RingtoneModule;
}

export async function createAlarmChannel(): Promise<string> {
  return notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: "Alarms",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    bypassDnd: true,
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

export async function getAlarmDeliveryStatus(): Promise<AlarmDeliveryStatus> {
  const settings = await notifee.getNotificationSettings();
  if (Platform.OS !== "android") {
    return {
      notificationsEnabled:
        settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
      exactAlarmsEnabled: true,
      fullScreenIntentEnabled: true,
    };
  }
  const capabilityModule = getRingtoneCapabilityModule();
  const nativeCapabilities = capabilityModule?.getAlarmCapabilities
    ? await capabilityModule.getAlarmCapabilities()
    : undefined;

  return {
    notificationsEnabled:
      settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
    exactAlarmsEnabled:
      settings.android?.alarm !== AndroidNotificationSetting.DISABLED &&
      (nativeCapabilities?.canScheduleExactAlarms ?? true),
    fullScreenIntentEnabled: nativeCapabilities?.canUseFullScreenIntent ?? true,
  };
}

export async function openExactAlarmPermissionSettings(): Promise<void> {
  await notifee.openAlarmPermissionSettings();
}

export async function openFullScreenIntentPermissionSettings(): Promise<void> {
  const capabilities = getRingtoneCapabilityModule();
  if (capabilities?.openFullScreenIntentSettings) {
    await capabilities.openFullScreenIntentSettings();
  }
}

export { ALARM_CHANNEL_ID, TIMER_CHANNEL_ID };
