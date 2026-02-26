import type { DismissalMethod } from "./Settings";

export interface AlarmRepeat {
  type: "interval" | "weekdays" | "customCycleInterval";
  intervalMs?: number;
  weekdays?: number[];
  customCycleIntervalDays?: number;
}

export interface Alarm {
  id: string;
  label: string;
  enabled: boolean;
  targetTimestampMs: number;
  setInTimeSystem: "custom" | "24h";
  repeat: AlarmRepeat | null;
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number;
  snoozeDurationMin: number;
  snoozeMaxCount: number;
  snoozeCount: number;
  autoSilenceMin: number;
  soundUri: string | null;
  vibrationEnabled: boolean;
  notifeeTriggerId: string | null;
  skipNextOccurrence: boolean;
  linkedCalendarEventId: string | null;
  linkedEventOffsetMs: number;
  lastFiredAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface BulkAlarmParams {
  fromHour: number;
  fromMinute: number;
  toHour: number;
  toMinute: number;
  intervalMinutes: number;
  timeSystem: "custom" | "24h";
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number;
  label: string;
}
