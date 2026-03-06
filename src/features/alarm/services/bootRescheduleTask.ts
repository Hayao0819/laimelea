import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import type { Alarm } from "../../../models/Alarm";
import { rescheduleAllEnabledAlarms } from "./alarmRescheduler";

export default async function bootRescheduleTask(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALARMS);
    if (!raw) return;
    const alarms: Alarm[] = JSON.parse(raw);
    await rescheduleAllEnabledAlarms(alarms);
  } catch {
    // Silently fail - alarms will be rescheduled when app opens
  }
}
