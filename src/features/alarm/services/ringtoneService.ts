import { NativeModules } from "react-native";

export interface RingtoneInfo {
  title: string;
  uri: string;
}

interface RingtoneModuleSpec {
  getAlarmRingtones(): Promise<RingtoneInfo[]>;
  playRingtone(uri: string): Promise<void>;
  stopRingtone(): Promise<void>;
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
  getDefaultAlarmUri,
};
