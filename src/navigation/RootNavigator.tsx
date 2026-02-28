import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";

import { BottomTabNavigator } from "./BottomTabNavigator";
import { DeskClockScreen } from "../features/clock/screens/DeskClockScreen";
import { SettingsScreen } from "../features/settings/screens/SettingsScreen";
import { AlarmEditScreen } from "../features/alarm/screens/AlarmEditScreen";
import { AlarmFiringScreen } from "../features/alarm/screens/AlarmFiringScreen";
import { BulkAlarmScreen } from "../features/alarm/screens/BulkAlarmScreen";
import { ManualSleepEntryScreen } from "../features/sleep/screens/ManualSleepEntryScreen";
import { EventDetailScreen } from "../features/calendar/screens/EventDetailScreen";
import { setupCompleteAtom, settingsLoadedAtom } from "../atoms/settingsAtoms";
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
        </>
      )}
    </Stack.Navigator>
  );
}
