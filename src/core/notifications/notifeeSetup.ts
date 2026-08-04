import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
} from "@notifee/react-native";
import { NativeModules } from "react-native";

const ALARM_CHANNEL_ID = "alarm";
const TIMER_CHANNEL_ID = "timer";
const ALARM_CHANNEL_GROUP_ID = "alarms";
const ALARM_VIBRATION_PATTERN = [300, 500, 200, 500];

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

export async function createAlarmDeliveryChannel(
  vibrationEnabled: boolean,
): Promise<string> {
  const channelId = `alarm-v2-${vibrationEnabled ? "vibrate" : "still"}`;

  await notifee.createChannelGroup({
    id: ALARM_CHANNEL_GROUP_ID,
    name: "Alarms",
  });

  return notifee.createChannel({
    id: channelId,
    name: "Alarm",
    groupId: ALARM_CHANNEL_GROUP_ID,
    importance: AndroidImportance.HIGH,
    sound: undefined,
    vibration: vibrationEnabled,
    vibrationPattern: vibrationEnabled ? ALARM_VIBRATION_PATTERN : undefined,
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
  const capabilityModule = getRingtoneCapabilityModule();
  const nativeCapabilities = capabilityModule?.getAlarmCapabilities
    ? await capabilityModule.getAlarmCapabilities()
    : undefined;

  return {
    notificationsEnabled:
      settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED,
    exactAlarmsEnabled:
      settings.android.alarm !== AndroidNotificationSetting.DISABLED &&
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

export { ALARM_CHANNEL_ID, ALARM_VIBRATION_PATTERN, TIMER_CHANNEL_ID };
