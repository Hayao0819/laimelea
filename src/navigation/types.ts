import type { NavigatorScreenParams } from "@react-navigation/native";

export type BottomTabParamList = {
  ClockTab: undefined;
  AlarmTab: undefined;
  CalendarTab: undefined;
  SleepTab: undefined;
  TimerTab: undefined;
};

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
  SettingsLegal: undefined;
  SettingsLicenses: undefined;
  Game2048: undefined;
  Game2048Settings: undefined;
  Game2048Tree: undefined;
  AlarmFiring: { alarmId: string };
  ManualSleepEntry: { sessionId?: string };
  DeskClock: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
