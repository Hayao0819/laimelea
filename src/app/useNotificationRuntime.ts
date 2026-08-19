import notifee from "@notifee/react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { timersAtom, timersHydratedAtom } from "../atoms/timerAtoms";
import { setupForegroundHandler } from "../core/notifications/foregroundHandler";
import { completeTimers } from "../features/timer/services/timerState";
import {
  enqueueAlarmFiringNavigation,
  resetAlarmFiringNavigation,
} from "./navigation";

export function useNotificationRuntime(): void {
  const setAlarms = useSetAtom(alarmsAtom);
  const setTimers = useSetAtom(timersAtom);
  const timersHydrated = useAtomValue(timersHydratedAtom);
  const timersHydratedRef = useRef(timersHydrated);
  timersHydratedRef.current = timersHydrated;

  useEffect(() => {
    const unsubscribe = setupForegroundHandler(
      (alarmId) => {
        enqueueAlarmFiringNavigation(alarmId);
      },
      setAlarms,
      (timerId) => {
        if (!timersHydratedRef.current) return;
        setTimers((timers) => completeTimers(timers, [timerId]));
      },
    );
    return () => {
      unsubscribe();
      resetAlarmFiringNavigation();
    };
  }, [setAlarms, setTimers]);

  useEffect(() => {
    let cancelled = false;
    const checkInitialNotification = async () => {
      const initial = await notifee.getInitialNotification();
      const alarmId = initial?.notification?.data?.alarmId;
      if (cancelled || typeof alarmId !== "string") return;
      // enqueueAlarmFiringNavigation retries internally until the
      // navigation container is ready; no local polling needed here.
      enqueueAlarmFiringNavigation(alarmId);
    };
    checkInitialNotification().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
}
