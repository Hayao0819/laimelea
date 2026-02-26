import React, { useCallback } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Appbar, BottomNavigation } from "react-native-paper";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import { ClockScreen } from "../features/clock/screens/ClockScreen";
import { AlarmListScreen } from "../features/alarm/screens/AlarmListScreen";
import { CalendarScreen } from "../features/calendar/screens/CalendarScreen";
import { SleepLogScreen } from "../features/sleep/screens/SleepLogScreen";
import { TimerScreen } from "../features/timer/screens/TimerScreen";
import type { BottomTabParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<BottomTabParamList>();

function ClockTabIcon({ color, size }: { color: string; size: number }) {
  return <Icon name="clock-outline" size={size} color={color} />;
}

function AlarmTabIcon({ color, size }: { color: string; size: number }) {
  return <Icon name="alarm" size={size} color={color} />;
}

function CalendarTabIcon({ color, size }: { color: string; size: number }) {
  return <Icon name="calendar" size={size} color={color} />;
}

function SleepTabIcon({ color, size }: { color: string; size: number }) {
  return <Icon name="power-sleep" size={size} color={color} />;
}

function TimerTabIcon({ color, size }: { color: string; size: number }) {
  return <Icon name="timer-outline" size={size} color={color} />;
}

function TabBar({ navigation, state, descriptors, insets }: BottomTabBarProps) {
  return (
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
  );
}

export function BottomTabNavigator() {
  const { t } = useTranslation();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const renderHeader = useCallback(
    ({ options }: { options: { title?: string } }) => (
      <Appbar.Header elevated={false}>
        <Appbar.Content title={options.title ?? ""} />
        <Appbar.Action
          icon="cog-outline"
          onPress={() => rootNavigation.navigate("Settings")}
        />
      </Appbar.Header>
    ),
    [rootNavigation],
  );

  return (
    <Tab.Navigator
      tabBar={TabBar}
      screenOptions={{
        header: renderHeader,
      }}
    >
      <Tab.Screen
        name="ClockTab"
        component={ClockScreen}
        options={{
          title: t("tabs.clock"),
          tabBarIcon: ClockTabIcon,
        }}
      />
      <Tab.Screen
        name="AlarmTab"
        component={AlarmListScreen}
        options={{
          title: t("tabs.alarm"),
          tabBarIcon: AlarmTabIcon,
        }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{
          title: t("tabs.calendar"),
          tabBarIcon: CalendarTabIcon,
        }}
      />
      <Tab.Screen
        name="SleepTab"
        component={SleepLogScreen}
        options={{
          title: t("tabs.sleep"),
          tabBarIcon: SleepTabIcon,
        }}
      />
      <Tab.Screen
        name="TimerTab"
        component={TimerScreen}
        options={{
          title: t("tabs.timer"),
          tabBarIcon: TimerTabIcon,
        }}
      />
    </Tab.Navigator>
  );
}
