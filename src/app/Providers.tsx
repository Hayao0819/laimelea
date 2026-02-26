import React, { useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import {
  DefaultTheme as NavLightTheme,
  DarkTheme as NavDarkTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";

import { lightTheme, darkTheme } from "./theme";
import { settingsAtom } from "../atoms/settingsAtoms";
import { platformTypeAtom } from "../atoms/platformAtoms";
import { detectPlatform } from "../core/platform/detection";
import {
  createAlarmChannel,
  createTimerChannel,
  ensureNotificationPermissions,
} from "../core/notifications/notifeeSetup";
import "../core/i18n";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const systemColorScheme = useColorScheme();
  const settings = useAtomValue(settingsAtom);
  const setPlatformType = useSetAtom(platformTypeAtom);

  useEffect(() => {
    createAlarmChannel();
    createTimerChannel();
    ensureNotificationPermissions();
    detectPlatform().then(setPlatformType);
  }, [setPlatformType]);

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
      <NavigationContainer theme={navigationTheme}>
        {children}
      </NavigationContainer>
    </PaperProvider>
  );
}
