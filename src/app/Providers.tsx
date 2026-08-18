import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { useAtomValue } from "jotai";
import React, { useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

import { resolvedSettingsAtom } from "../atoms/settingsAtoms";
import i18n, { resolveLanguage } from "../core/i18n";
import { navigationRef } from "./navigation";
import { darkTheme, lightTheme } from "./theme";
import { useAlarmRuntime } from "./useAlarmRuntime";
import { useAppInitialization } from "./useAppInitialization";
import { useNotificationRuntime } from "./useNotificationRuntime";
import { useRestoreRecovery } from "./useRestoreRecovery";

export { navigationRef } from "./navigation";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const systemColorScheme = useColorScheme();
  const settings = useAtomValue(resolvedSettingsAtom);
  useAppInitialization();
  const restoreRecoveryComplete = useRestoreRecovery();
  useAlarmRuntime(restoreRecoveryComplete);
  useNotificationRuntime();

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
