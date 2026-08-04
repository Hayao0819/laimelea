import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import type { Alarm } from "../../../models/Alarm";
import { type AppSettings, DEFAULT_SETTINGS } from "../../../models/Settings";
import { rescheduleAllEnabledAlarms } from "./alarmRescheduler";

export default async function bootRescheduleTask(): Promise<void> {
  try {
    const [rawAlarms, rawSettings] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.ALARMS),
      AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
    ]);
    if (!rawAlarms) return;
    const alarms: Alarm[] = JSON.parse(rawAlarms);
    const settings: AppSettings = rawSettings
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) }
      : DEFAULT_SETTINGS;
    const rescheduledAlarms = await rescheduleAllEnabledAlarms(
      alarms,
      settings.cycleConfig,
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.ALARMS,
      JSON.stringify(rescheduledAlarms),
    );
  } catch {
    // Silently fail - alarms will be rescheduled when app opens
  }
}
