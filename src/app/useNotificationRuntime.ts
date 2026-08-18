import notifee from "@notifee/react-native";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { timersAtom } from "../atoms/timerAtoms";
import { setupForegroundHandler } from "../core/notifications/foregroundHandler";
import { completeTimers } from "../features/timer/services/timerState";
import { navigationRef } from "./navigation";

export function useNotificationRuntime(): void {
  const setAlarms = useSetAtom(alarmsAtom);
  const setTimers = useSetAtom(timersAtom);

  useEffect(() => {
    return setupForegroundHandler(
      (alarmId) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate("AlarmFiring", { alarmId });
        }
      },
      setAlarms,
      (timerId) => {
        setTimers((timers) => completeTimers(timers, [timerId]));
      },
    );
  }, [setAlarms, setTimers]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const checkInitialNotification = async () => {
      const initial = await notifee.getInitialNotification();
      if (!initial?.notification?.data?.alarmId) return;
      const alarmId = initial.notification.data.alarmId as string;
      intervalId = setInterval(() => {
        if (!navigationRef.isReady()) return;
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
        navigationRef.navigate("AlarmFiring", { alarmId });
      }, 100);
      timeoutId = setTimeout(() => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        timeoutId = null;
      }, 5000);
    };
    checkInitialNotification().catch(() => undefined);
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
}
