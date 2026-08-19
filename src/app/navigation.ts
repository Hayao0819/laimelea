import { createNavigationContainerRef } from "@react-navigation/native";

import { setAlarmWindowActive } from "../features/alarm/services/ringtoneService";
import type { RootStackParamList } from "../navigation/types";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const pendingAlarmIds: string[] = [];
const completedAlarmIds = new Set<string>();
let activeAlarmId: string | null = null;
let navigationRetry: ReturnType<typeof setTimeout> | null = null;

function showNextAlarm(): void {
  if (activeAlarmId !== null || pendingAlarmIds.length === 0) return;
  if (!navigationRef.isReady()) {
    navigationRetry ??= setTimeout(() => {
      navigationRetry = null;
      showNextAlarm();
    }, 100);
    return;
  }
  activeAlarmId = pendingAlarmIds.shift() ?? null;
  if (activeAlarmId === null) return;
  completedAlarmIds.delete(activeAlarmId);
  setAlarmWindowActive(true).catch(() => undefined);
  navigationRef.navigate("AlarmFiring", { alarmId: activeAlarmId });
}

export function enqueueAlarmFiringNavigation(alarmId: string): void {
  if (alarmId === activeAlarmId || pendingAlarmIds.includes(alarmId)) return;
  completedAlarmIds.delete(alarmId);
  pendingAlarmIds.push(alarmId);
  showNextAlarm();
}

export function completeAlarmFiringNavigation(alarmId: string): void {
  if (completedAlarmIds.has(alarmId)) return;
  completedAlarmIds.add(alarmId);
  const pendingIndex = pendingAlarmIds.indexOf(alarmId);
  if (pendingIndex >= 0) pendingAlarmIds.splice(pendingIndex, 1);
  const route = navigationRef.getCurrentRoute();
  if (activeAlarmId !== alarmId) {
    if (
      activeAlarmId === null &&
      route?.name === "AlarmFiring" &&
      route.params != null &&
      "alarmId" in route.params &&
      route.params.alarmId === alarmId &&
      navigationRef.canGoBack()
    ) {
      navigationRef.goBack();
      if (pendingAlarmIds.length === 0) {
        setAlarmWindowActive(false).catch(() => undefined);
      }
    }
    return;
  }

  activeAlarmId = null;
  if (
    route?.name === "AlarmFiring" &&
    route.params != null &&
    "alarmId" in route.params &&
    route.params.alarmId === alarmId &&
    navigationRef.canGoBack()
  ) {
    navigationRef.goBack();
  }
  if (pendingAlarmIds.length === 0) {
    setAlarmWindowActive(false).catch(() => undefined);
  } else {
    setTimeout(showNextAlarm, 0);
  }
}

export function resetAlarmFiringNavigation(): void {
  pendingAlarmIds.splice(0);
  completedAlarmIds.clear();
  activeAlarmId = null;
  if (navigationRetry !== null) clearTimeout(navigationRetry);
  navigationRetry = null;
  setAlarmWindowActive(false).catch(() => undefined);
}
