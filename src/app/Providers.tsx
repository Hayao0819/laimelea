import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { useAtomValue } from "jotai";

import { lightTheme, darkTheme } from "./theme";
import { settingsAtom } from "../atoms/settingsAtoms";
import {
  createAlarmChannel,
  ensureNotificationPermissions,
} from "../core/notifications/notifeeSetup";
import "../core/i18n";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const systemColorScheme = useColorScheme();
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    createAlarmChannel();
    ensureNotificationPermissions();
  }, []);

  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" && systemColorScheme === "dark");

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>{children}</NavigationContainer>
    </PaperProvider>
  );
}
