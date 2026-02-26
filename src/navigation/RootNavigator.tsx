import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";

import { BottomTabNavigator } from "./BottomTabNavigator";
import { SettingsScreen } from "../features/settings/screens/SettingsScreen";
import { settingsAtom } from "../atoms/settingsAtoms";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const settings = useAtomValue(settingsAtom);
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      {!settings.setupComplete ? (
        <Stack.Screen
          name="Setup"
          getComponent={() =>
            require("../features/clock/screens/ClockScreen").ClockScreen
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
        </>
      )}
    </Stack.Navigator>
  );
}
