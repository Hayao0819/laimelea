import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import {
  readStoredAlarms,
  readStoredSettings,
} from "../../../core/storage/storedAppState";
import { rescheduleAllEnabledAlarms } from "./alarmRescheduler";

export default async function bootRescheduleTask(): Promise<void> {
  try {
    const [alarms, settings] = await Promise.all([
      readStoredAlarms(),
      readStoredSettings(),
    ]);
    if (!alarms) return;
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
