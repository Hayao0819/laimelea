import notifee from "@notifee/react-native";
import {
  createNavigationContainerRef,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, DeviceEventEmitter, useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { platformTypeAtom } from "../atoms/platformAtoms";
import { resolvedSettingsAtom, settingsAtom } from "../atoms/settingsAtoms";
import { sleepSessionsAtom } from "../atoms/sleepAtoms";
import { timersAtom } from "../atoms/timerAtoms";
import i18n, { resolveLanguage } from "../core/i18n";
import { setupForegroundHandler } from "../core/notifications/foregroundHandler";
import {
  createAlarmChannel,
  createTimerChannel,
  ensureNotificationPermissions,
} from "../core/notifications/notifeeSetup";
import { detectPlatform } from "../core/platform/detection";
import { processAlarmDelivery } from "../features/alarm/services/alarmDeliveryService";
import { rescheduleAllEnabledAlarms } from "../features/alarm/services/alarmRescheduler";
import {
  acknowledgeNativeAlarmDeliveries,
  consumeNativeAlarmDeliveries,
} from "../features/alarm/services/ringtoneService";
import { game2048StoreAtom } from "../features/game2048/atoms/game2048Atoms";
import {
  recoverPendingBackupRestore,
  waitForRestoreWrites,
} from "../features/settings/services/restoreTransaction";
import type { RootStackParamList } from "../navigation/types";
import { darkTheme, lightTheme } from "./theme";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const systemColorScheme = useColorScheme();
  const settings = useAtomValue(resolvedSettingsAtom);
  const alarms = useAtomValue(alarmsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const setSettings = useSetAtom(settingsAtom);
  const setSleepSessions = useSetAtom(sleepSessionsAtom);
  const setGame2048Store = useSetAtom(game2048StoreAtom);
  const setTimers = useSetAtom(timersAtom);
  const setPlatformType = useSetAtom(platformTypeAtom);
  const alarmsRef = useRef(alarms);
  const alarmSyncQueueRef = useRef(Promise.resolve());
  const [restoreRecoveryComplete, setRestoreRecoveryComplete] = useState(false);
  alarmsRef.current = alarms;

  useEffect(() => {
    createAlarmChannel();
    createTimerChannel();
    ensureNotificationPermissions();
    detectPlatform().then(setPlatformType);
  }, [setPlatformType]);

  useEffect(() => {
    let cancelled = false;
    const recover = async () => {
      let recovered = false;
      try {
        await recoverPendingBackupRestore(async (snapshot) => {
          await waitForRestoreWrites([
            Promise.resolve(setSettings(snapshot.settings)),
            Promise.resolve(setAlarms(snapshot.alarms)),
            Promise.resolve(setSleepSessions(snapshot.sleepSessions)),
            Promise.resolve(setGame2048Store(snapshot.game2048)),
          ]);
        });
        recovered = true;
      } catch {}
      if (!cancelled && recovered) setRestoreRecoveryComplete(true);
    };
    recover();
    return () => {
      cancelled = true;
    };
  }, [setAlarms, setGame2048Store, setSettings, setSleepSessions]);

  useEffect(() => {
    if (!restoreRecoveryComplete) return;
    let cancelled = false;
    const synchronizeAlarms = () => {
      const task = async () => {
        const deliveries = (await consumeNativeAlarmDeliveries())
          .slice()
          .sort(
            (left, right) =>
              left.occurrenceTimestampMs - right.occurrenceTimestampMs ||
              left.deliveryId.localeCompare(right.deliveryId),
          );
        for (const delivery of deliveries) {
          const result = await processAlarmDelivery(
            delivery,
            (updatedAlarms) => {
              alarmsRef.current = updatedAlarms;
              setAlarms(updatedAlarms);
            },
          );
          if (result.alarms) {
            try {
              await acknowledgeNativeAlarmDeliveries([delivery.deliveryId]);
            } catch {}
          }
          if (!result.handled || cancelled) continue;
          if (delivery.stopped) {
            const route = navigationRef.getCurrentRoute();
            const routeParams = route?.params;
            if (
              route?.name === "AlarmFiring" &&
              routeParams != null &&
              typeof routeParams === "object" &&
              "alarmId" in routeParams &&
              routeParams.alarmId === delivery.alarmId &&
              navigationRef.canGoBack()
            ) {
              navigationRef.goBack();
            }
            continue;
          }
          if (
            delivery.autoSilenceMs > 0 &&
            Date.now() >=
              delivery.occurrenceTimestampMs + delivery.autoSilenceMs
          ) {
            continue;
          }
          const alarmId = delivery.alarmId;
          const navigate = () => {
            if (!cancelled && navigationRef.isReady()) {
              navigationRef.navigate("AlarmFiring", { alarmId });
            }
          };
          navigate();
          if (!navigationRef.isReady()) {
            setTimeout(navigate, 100);
          }
        }
        const rescheduledAlarms = await rescheduleAllEnabledAlarms(
          alarmsRef.current,
          settings.cycleConfig,
        );
        if (!cancelled) {
          alarmsRef.current = rescheduledAlarms;
          setAlarms(rescheduledAlarms);
        }
      };
      const queued = alarmSyncQueueRef.current.then(task, task);
      alarmSyncQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    };
    synchronizeAlarms().catch(() => {});
    const deliverySubscription = DeviceEventEmitter.addListener(
      "NativeAlarmDelivery",
      () => {
        synchronizeAlarms().catch(() => {});
      },
    );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          synchronizeAlarms().catch(() => {});
        }
      },
    );
    return () => {
      cancelled = true;
      deliverySubscription.remove();
      appStateSubscription.remove();
    };
  }, [restoreRecoveryComplete, setAlarms, settings.cycleConfig]);

  useEffect(() => {
    const unsubscribe = setupForegroundHandler(
      (alarmId) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate("AlarmFiring", { alarmId });
        }
      },
      setAlarms,
      (timerId) => {
        setTimers((timers) =>
          timers.map((timer) =>
            timer.id === timerId && timer.isRunning
              ? { ...timer, remainingMs: 0, isRunning: false, startedAt: null }
              : timer,
          ),
        );
      },
    );
    return unsubscribe;
  }, [setAlarms, setTimers]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    async function checkInitialNotification() {
      const initial = await notifee.getInitialNotification();
      if (initial?.notification?.data?.alarmId) {
        const alarmId = initial.notification.data.alarmId as string;
        intervalId = setInterval(() => {
          if (navigationRef.isReady()) {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null;
            navigationRef.navigate("AlarmFiring", { alarmId });
          }
        }, 100);
        timeoutId = setTimeout(() => {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          timeoutId = null;
        }, 5000);
      }
    }
    checkInitialNotification();
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const lang = resolveLanguage(settings.language);
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [settings.language]);

  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" && systemColorScheme === "dark");

  const theme = isDark ? darkTheme : lightTheme;

  const navigationTheme = useMemo(() => {
    const base = isDark ? NavDarkTheme : NavLightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
      },
    };
  }, [isDark, theme]);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PaperProvider theme={theme}>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          {children}
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
