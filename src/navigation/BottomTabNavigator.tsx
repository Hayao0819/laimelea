import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomNavigation } from "react-native-paper";
import { CommonActions } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import { ClockScreen } from "../features/clock/screens/ClockScreen";
import { AlarmListScreen } from "../features/alarm/screens/AlarmListScreen";
import { CalendarScreen } from "../features/calendar/screens/CalendarScreen";
import { SleepLogScreen } from "../features/sleep/screens/SleepLogScreen";
import { TimerScreen } from "../features/timer/screens/TimerScreen";
import type { BottomTabParamList } from "./types";

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function BottomTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state}
          safeAreaInsets={insets}
          onTabPress={({ route, preventDefault }) => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) {
              preventDefault();
            } else {
              navigation.dispatch({
                ...CommonActions.navigate(route.name, route.params),
                target: state.key,
              });
            }
          }}
          renderIcon={({ route, focused, color }) => {
            const { options } = descriptors[route.key];
            if (options.tabBarIcon) {
              return options.tabBarIcon({ focused, color, size: 24 });
            }
            return null;
          }}
          getLabelText={({ route }) => {
            const { options } = descriptors[route.key];
            return typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : typeof options.title === "string"
                ? options.title
                : route.name;
          }}
        />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="ClockTab"
        component={ClockScreen}
        options={{
          title: t("tabs.clock"),
          tabBarIcon: ({ color, size }) => (
            <Icon name="clock-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AlarmTab"
        component={AlarmListScreen}
        options={{
          title: t("tabs.alarm"),
          tabBarIcon: ({ color, size }) => (
            <Icon name="alarm" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{
          title: t("tabs.calendar"),
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SleepTab"
        component={SleepLogScreen}
        options={{
          title: t("tabs.sleep"),
          tabBarIcon: ({ color, size }) => (
            <Icon name="power-sleep" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TimerTab"
        component={TimerScreen}
        options={{
          title: t("tabs.timer"),
          tabBarIcon: ({ color, size }) => (
            <Icon name="timer-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
