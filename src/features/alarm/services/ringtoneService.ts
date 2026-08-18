import { NativeModules, PermissionsAndroid, Platform } from "react-native";

export interface RingtoneInfo {
  title: string;
  uri: string;
}

export interface NativeAlarmDelivery {
  deliveryId: string;
  alarmId: string;
  occurrenceTimestampMs: number;
  autoSilenceMs: number;
  stopped: boolean;
}

interface RingtoneModuleSpec {
  getAlarmRingtones(): Promise<RingtoneInfo[]>;
  playRingtone(uri: string): Promise<void>;
  playAlarmSound(uri: string | null, volume: number): Promise<void>;
  setAlarmVolume(volume: number): Promise<void>;
  setAlarmVolumeButtonBehavior(
    behavior: "snooze" | "dismiss" | null,
  ): Promise<void>;
  stopRingtone(): Promise<void>;
  stopAlarmSound(alarmId: string): Promise<void>;
  scheduleAlarmAudio(
    alarmId: string,
    timestampMs: number,
    soundUri: string | null,
    gradualDurationMs: number,
    autoSilenceMs: number,
    rescheduleAtLocalTime: boolean,
    repeatType: string | null,
    repeatWeekdays: number[],
    repeatIntervalMs: number,
    label: string,
    vibrationEnabled: boolean,
  ): Promise<void>;
  cancelAlarmAudio(alarmId: string): Promise<void>;
  consumeAlarmDeliveries(): Promise<NativeAlarmDelivery[]>;
  acknowledgeAlarmDeliveries(deliveryIds: string[]): Promise<void>;
  getDefaultAlarmUri(): Promise<string>;
}

function getModule(): RingtoneModuleSpec | undefined {
  return NativeModules.RingtoneModule as RingtoneModuleSpec | undefined;
}

export async function getAlarmRingtones(): Promise<RingtoneInfo[]> {
  if (!(await canReadExternalAudio())) {
    return [];
  }
  const mod = getModule();
  if (!mod) {
    return [];
  }
  return mod.getAlarmRingtones();
}

async function canReadExternalAudio(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO;
  const granted = await PermissionsAndroid.check(permission);
  if (granted) {
    return true;
  }
  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function playRingtone(uri: string): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.playRingtone(uri);
}

export async function stopRingtone(): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.stopRingtone();
}

export async function stopAlarmSound(alarmId: string): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.stopAlarmSound(alarmId);
}

export async function playAlarmSound(
  uri: string | null,
  volume: number,
): Promise<void> {
  if (uri === "__silent__") {
    return;
  }
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.playAlarmSound(uri, Math.max(0, Math.min(volume, 1)));
}

export async function setAlarmVolume(volume: number): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.setAlarmVolume(Math.max(0, Math.min(volume, 1)));
}

export async function setAlarmVolumeButtonBehavior(
  behavior: "snooze" | "dismiss" | null,
): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.setAlarmVolumeButtonBehavior(behavior);
}

export async function scheduleAlarmAudio(
  alarmId: string,
  timestampMs: number,
  soundUri: string | null,
  gradualDurationMs: number,
  autoSilenceMs: number,
  rescheduleAtLocalTime = false,
  repeatType: string | null = null,
  repeatWeekdays: number[] = [],
  repeatIntervalMs = 0,
  label = "",
  vibrationEnabled = true,
): Promise<void> {
  const mod = getModule();
  if (!mod) {
    throw new Error("Alarm audio module is unavailable");
  }
  return mod.scheduleAlarmAudio(
    alarmId,
    timestampMs,
    soundUri,
    Math.max(0, gradualDurationMs),
    Math.max(0, autoSilenceMs),
    rescheduleAtLocalTime,
    repeatType,
    repeatWeekdays,
    Math.max(0, repeatIntervalMs),
    label,
    vibrationEnabled,
  );
}

export async function cancelAlarmAudio(alarmId: string): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.cancelAlarmAudio(alarmId);
}

export async function consumeNativeAlarmDeliveries(): Promise<
  NativeAlarmDelivery[]
> {
  const mod = getModule();
  if (!mod) {
    return [];
  }
  return mod.consumeAlarmDeliveries();
}

export async function acknowledgeNativeAlarmDeliveries(
  deliveryIds: string[],
): Promise<void> {
  const mod = getModule();
  if (!mod || deliveryIds.length === 0) {
    return;
  }
  return mod.acknowledgeAlarmDeliveries(deliveryIds);
}

export async function getDefaultAlarmUri(): Promise<string> {
  const mod = getModule();
  if (!mod) {
    return "default";
  }
  return mod.getDefaultAlarmUri();
}

export const RingtoneService = {
  getAlarmRingtones,
  playPreview: playRingtone,
  stopPreview: stopRingtone,
  playAlarmSound,
  setAlarmVolume,
  setAlarmVolumeButtonBehavior,
  stopAlarmSound,
  scheduleAlarmAudio,
  cancelAlarmAudio,
  consumeNativeAlarmDeliveries,
  acknowledgeNativeAlarmDeliveries,
  getDefaultAlarmUri,
};
