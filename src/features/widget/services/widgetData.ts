import {
  readStoredAlarms,
  readStoredSettings,
} from "../../../core/storage/storedAppState";
import type { Alarm } from "../../../models/Alarm";
import type { AppSettings } from "../../../models/Settings";

export async function loadSettings(): Promise<AppSettings> {
  return readStoredSettings();
}

export async function loadAlarms(): Promise<Alarm[]> {
  return (await readStoredAlarms()) ?? [];
}
