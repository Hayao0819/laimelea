import type { CycleConfig } from "./CustomTime";
import type { PlatformType } from "../core/platform/types";
import { DEFAULT_CYCLE_LENGTH_MINUTES } from "../core/time/constants";
export type DismissalMethod = "simple" | "shake" | "math";

export interface AlarmDefaults {
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number;
  snoozeDurationMin: number;
  snoozeMaxCount: number;
  vibrationEnabled: boolean;
  volumeButtonBehavior: "snooze" | "dismiss" | "volume";
}

export interface WidgetSettings {
  backgroundColor: string;
  textColor: string;
  secondaryTextColor: string;
  accentColor: string;
  opacity: number;
  borderRadius: number;
  showRealTime: boolean;
  showNextAlarm: boolean;
}

export interface AppSettings {
  cycleConfig: CycleConfig;
  setupComplete: boolean;
  primaryTimeDisplay: "custom" | "24h";
  language: string;
  theme: "light" | "dark" | "system";
  timeFormat: "12h" | "24h";
  detectedPlatform: PlatformType;
  timezone: string;
  dstHandling: "auto" | "ignore";
  secondaryTimezone: string | null;
  alarmDefaults: AlarmDefaults;
  calendarFirstDayOfWeek: 0 | 1 | 6;
  defaultEventReminderMin: number;
  visibleCalendarIds: string[];
  lastBackupTimestamp: number | null;
  widgetSettings: WidgetSettings;
}

export const DEFAULT_ALARM_DEFAULTS: AlarmDefaults = {
  dismissalMethod: "simple",
  gradualVolumeDurationSec: 30,
  snoozeDurationMin: 5,
  snoozeMaxCount: 3,
  vibrationEnabled: true,
  volumeButtonBehavior: "snooze",
};

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  backgroundColor: "#1C1B1F",
  textColor: "#E6E1E5",
  secondaryTextColor: "#CAC4D0",
  accentColor: "#D0BCFF",
  opacity: 100,
  borderRadius: 16,
  showRealTime: true,
  showNextAlarm: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
  cycleConfig: {
    cycleLengthMinutes: DEFAULT_CYCLE_LENGTH_MINUTES, // 26h
    baseTimeMs: 0,
  },
  setupComplete: false,
  primaryTimeDisplay: "custom",
  language: "auto",
  theme: "system",
  timeFormat: "24h",
  detectedPlatform: "aosp",
  timezone: "auto",
  dstHandling: "auto",
  secondaryTimezone: null,
  alarmDefaults: DEFAULT_ALARM_DEFAULTS,
  calendarFirstDayOfWeek: 1,
  defaultEventReminderMin: 15,
  visibleCalendarIds: [],
  lastBackupTimestamp: null,
  widgetSettings: DEFAULT_WIDGET_SETTINGS,
};
