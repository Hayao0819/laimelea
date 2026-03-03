import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAtomValue } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";

import { settingsLoadedAtom,setupCompleteAtom } from "../atoms/settingsAtoms";
import { AlarmEditScreen } from "../features/alarm/screens/AlarmEditScreen";
import { AlarmFiringScreen } from "../features/alarm/screens/AlarmFiringScreen";
import { BulkAlarmScreen } from "../features/alarm/screens/BulkAlarmScreen";
import { EventDetailScreen } from "../features/calendar/screens/EventDetailScreen";
import { DeskClockScreen } from "../features/clock/screens/DeskClockScreen";
import { Game2048Screen } from "../features/game2048/screens/Game2048Screen";
import { Game2048SettingsScreen } from "../features/game2048/screens/Game2048SettingsScreen";
import { Game2048TreeScreen } from "../features/game2048/screens/Game2048TreeScreen";
import { AboutScreen } from "../features/settings/screens/AboutScreen";
import { AlarmDefaultsScreen } from "../features/settings/screens/AlarmDefaultsScreen";
import { BackupScreen } from "../features/settings/screens/BackupScreen";
import { CalendarSettingsScreen } from "../features/settings/screens/CalendarSettingsScreen";
import { CycleConfigScreen } from "../features/settings/screens/CycleConfigScreen";
import { GeneralSettingsScreen } from "../features/settings/screens/GeneralSettingsScreen";
import { LegalScreen } from "../features/settings/screens/LegalScreen";
import { LicensesScreen } from "../features/settings/screens/LicensesScreen";
import { SettingsScreen } from "../features/settings/screens/SettingsScreen";
import { TimezoneSettingsScreen } from "../features/settings/screens/TimezoneSettingsScreen";
import { WidgetSettingsScreen } from "../features/settings/screens/WidgetSettingsScreen";
import { ManualSleepEntryScreen } from "../features/sleep/screens/ManualSleepEntryScreen";
import { BottomTabNavigator } from "./BottomTabNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const settingsLoaded = useAtomValue(settingsLoadedAtom);
  const setupComplete = useAtomValue(setupCompleteAtom);
  const { t } = useTranslation();

  // Settings still loading from AsyncStorage — keep native splash visible
  if (!settingsLoaded) return null;

  return (
    <Stack.Navigator>
      {!setupComplete ? (
        <Stack.Screen
          name="Setup"
          getComponent={() =>
            require("../features/setup/screens/SetupScreen").SetupScreen
          }
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={BottomTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: t("settings.title") }}
          />
          <Stack.Screen
            name="SettingsCycleConfig"
            component={CycleConfigScreen}
            options={{ title: t("settings.cycleConfig") }}
          />
          <Stack.Screen
            name="SettingsGeneral"
            component={GeneralSettingsScreen}
            options={{ title: t("settings.general") }}
          />
          <Stack.Screen
            name="SettingsTimezone"
            component={TimezoneSettingsScreen}
            options={{ title: t("settings.timezone") }}
          />
          <Stack.Screen
            name="SettingsAlarmDefaults"
            component={AlarmDefaultsScreen}
            options={{ title: t("settings.alarmDefaults") }}
          />
          <Stack.Screen
            name="SettingsCalendar"
            component={CalendarSettingsScreen}
            options={{ title: t("settings.calendarSection") }}
          />
          <Stack.Screen
            name="SettingsWidget"
            component={WidgetSettingsScreen}
            options={{ title: t("settings.widget") }}
          />
          <Stack.Screen
            name="SettingsBackup"
            component={BackupScreen}
            options={{ title: t("settings.backup") }}
          />
          <Stack.Screen
            name="SettingsAbout"
            component={AboutScreen}
            options={{ title: t("settings.about") }}
          />
          <Stack.Screen
            name="SettingsLegal"
            component={LegalScreen}
            options={{ title: t("settings.legal") }}
          />
          <Stack.Screen
            name="SettingsLicenses"
            component={LicensesScreen}
            options={{ title: t("settings.openSourceLicenses") }}
          />
          <Stack.Screen
            name="AlarmEdit"
            component={AlarmEditScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="BulkAlarm"
            component={BulkAlarmScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ title: t("calendar.eventDetail") }}
          />
          <Stack.Screen
            name="ManualSleepEntry"
            component={ManualSleepEntryScreen}
            options={{
              title: t("sleep.manualEntry"),
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="AlarmFiring"
            component={AlarmFiringScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="DeskClock"
            component={DeskClockScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: false,
              animation: "fade",
            }}
          />
          <Stack.Screen
            name="Game2048"
            component={Game2048Screen}
            options={{ title: t("game2048.title") }}
          />
          <Stack.Screen
            name="Game2048Settings"
            component={Game2048SettingsScreen}
            options={{ title: t("game2048.settings") }}
          />
          <Stack.Screen
            name="Game2048Tree"
            component={Game2048TreeScreen}
            options={{ title: t("game2048.snapshotTree") }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
