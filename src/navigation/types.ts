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
  AlarmFiring: { alarmId: string };
  ManualSleepEntry: { sessionId?: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
