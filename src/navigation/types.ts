import type { NavigatorScreenParams } from "@react-navigation/native";

import type { Alarm } from "../models/Alarm";

export type BottomTabParamList = {
  ClockTab: undefined;
  AlarmTab: undefined;
  CalendarTab: undefined;
  SleepTab: undefined;
  TimerTab: undefined;
};

export type AlarmFiringParams =
  | { alarmId: string }
  | { isPreview: true; alarm: Alarm };

export type RootStackParamList = {
  Setup: undefined;
  MainTabs: NavigatorScreenParams<BottomTabParamList>;
  AlarmEdit: { alarmId?: string };
  BulkAlarm: undefined;
  EventDetail: { eventId: string };
  Settings: undefined;
  SettingsCycleConfig: undefined;
  SettingsGeneral: undefined;
  SettingsTimezone: undefined;
  SettingsAlarmDefaults: undefined;
  SettingsCalendar: undefined;
  SettingsWidget: undefined;
  SettingsBackup: undefined;
  SettingsAbout: undefined;
  SettingsLicenses: undefined;
  Game2048: undefined;
  Game2048Settings: undefined;
  Game2048Tree: undefined;
  AlarmFiring: AlarmFiringParams;
  ManualSleepEntry: { sessionId?: string };
  DeskClock: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
