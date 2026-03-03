import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import type { Alarm } from "../../../models/Alarm";
import type { AppSettings } from "../../../models/Settings";
import { DEFAULT_SETTINGS } from "../../../models/Settings";

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_SETTINGS;
}

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALARMS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Fall through to default
  }
  return [];
}
