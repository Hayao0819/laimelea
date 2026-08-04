import { NativeModules } from "react-native";

export interface RingtoneInfo {
  title: string;
  uri: string;
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
  ): Promise<void>;
  cancelAlarmAudio(alarmId: string): Promise<void>;
  getDefaultAlarmUri(): Promise<string>;
}

function getModule(): RingtoneModuleSpec | undefined {
  return NativeModules.RingtoneModule as RingtoneModuleSpec | undefined;
}

export async function getAlarmRingtones(): Promise<RingtoneInfo[]> {
  const mod = getModule();
  if (!mod) {
    return [];
  }
  return mod.getAlarmRingtones();
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
): Promise<void> {
  if (soundUri === "__silent__") {
    return;
  }
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
  );
}

export async function cancelAlarmAudio(alarmId: string): Promise<void> {
  const mod = getModule();
  if (!mod) {
    return;
  }
  return mod.cancelAlarmAudio(alarmId);
}

export async function getDefaultAlarmUri(): Promise<string> {
  const mod = getModule();
  if (!mod) {
    return "default";
  }
  return mod.getDefaultAlarmUri();
}

/** Object-style API for component usage */
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
  getDefaultAlarmUri,
};
