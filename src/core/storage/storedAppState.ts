import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Alarm } from "../../models/Alarm";
import { type AppSettings, DEFAULT_SETTINGS } from "../../models/Settings";
import { normalizeAlarms, resolveSettings } from "./appState";
import { STORAGE_KEYS } from "./keys";

export async function readStoredSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    return resolveSettings(raw ? JSON.parse(raw) : undefined);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function readStoredAlarms(): Promise<Alarm[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALARMS);
    if (!raw) {
      return null;
    }
    return normalizeAlarms(JSON.parse(raw));
  } catch {
    return null;
  }
}
