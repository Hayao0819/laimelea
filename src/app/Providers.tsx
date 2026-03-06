import notifee from "@notifee/react-native";
import {
  createNavigationContainerRef,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useEffect, useMemo, useRef } from "react";
import { AppState, useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { platformTypeAtom } from "../atoms/platformAtoms";
import { settingsAtom } from "../atoms/settingsAtoms";
import i18n, { resolveLanguage } from "../core/i18n";
import { setupForegroundHandler } from "../core/notifications/foregroundHandler";
import {
  createAlarmChannel,
  createTimerChannel,
  ensureNotificationPermissions,
} from "../core/notifications/notifeeSetup";
import { detectPlatform } from "../core/platform/detection";
import { rescheduleAllEnabledAlarms } from "../features/alarm/services/alarmRescheduler";
import type { RootStackParamList } from "../navigation/types";
import { darkTheme, lightTheme } from "./theme";

export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const systemColorScheme = useColorScheme();
  const settings = useAtomValue(settingsAtom);
  const alarms = useAtomValue(alarmsAtom);
  const setPlatformType = useSetAtom(platformTypeAtom);
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;

  useEffect(() => {
    createAlarmChannel();
    createTimerChannel();
    ensureNotificationPermissions();
    detectPlatform().then(setPlatformType);
  }, [setPlatformType]);

  useEffect(() => {
    rescheduleAllEnabledAlarms(alarmsRef.current);

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        rescheduleAllEnabledAlarms(alarmsRef.current);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = setupForegroundHandler((alarmId) => {
      if (navigationRef.isReady()) {
        navigationRef.navigate("AlarmFiring", { alarmId });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    async function checkInitialNotification() {
      const initial = await notifee.getInitialNotification();
      if (initial?.notification?.data?.alarmId) {
        const alarmId = initial.notification.data.alarmId as string;
        intervalId = setInterval(() => {
          if (navigationRef.isReady()) {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            navigationRef.navigate("AlarmFiring", { alarmId });
          }
        }, 100);
        setTimeout(() => {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }, 5000);
      }
    }
    checkInitialNotification();
    return () => {
      if (intervalId) clearInterval(intervalId);
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
    <PaperProvider theme={theme}>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {children}
      </NavigationContainer>
    </PaperProvider>
  );
}
