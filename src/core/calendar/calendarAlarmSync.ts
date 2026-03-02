import type { Alarm } from "../../models/Alarm";
import type { CalendarEvent } from "../../models/CalendarEvent";
import type { DismissalMethod, MathDifficulty } from "../../models/Settings";

export interface AlarmSyncResult {
  updatedAlarms: Alarm[];
  orphanedAlarmIds: string[];
}

/**
 * カレンダー予定に連動するアラームを同期する。
 * 予定の開始時刻 + offset から targetTimestampMs を再計算する。
 */
export function syncCalendarAlarms(
  alarms: Alarm[],
  events: CalendarEvent[],
): AlarmSyncResult {
  const eventMap = new Map<string, CalendarEvent>();
  for (const event of events) {
    eventMap.set(event.sourceEventId, event);
    eventMap.set(event.id, event);
  }

  const updatedAlarms: Alarm[] = [];
  const orphanedAlarmIds: string[] = [];

  for (const alarm of alarms) {
    if (alarm.linkedCalendarEventId == null) {
      updatedAlarms.push(alarm);
      continue;
    }

    const event = eventMap.get(alarm.linkedCalendarEventId);
    if (event == null) {
      orphanedAlarmIds.push(alarm.id);
      updatedAlarms.push(alarm);
      continue;
    }

    const newTargetMs = event.startTimestampMs + alarm.linkedEventOffsetMs;
    if (newTargetMs !== alarm.targetTimestampMs) {
      updatedAlarms.push({
        ...alarm,
        targetTimestampMs: newTargetMs,
        updatedAt: Date.now(),
      });
    } else {
      updatedAlarms.push(alarm);
    }
  }

  return { updatedAlarms, orphanedAlarmIds };
}

export interface AlarmCreationDefaults {
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number;
  snoozeDurationMin: number;
  snoozeMaxCount: number;
  vibrationEnabled: boolean;
  mathDifficulty: MathDifficulty;
}

/**
 * カレンダー予定からアラームを作成する。
 */
export function createAlarmFromEvent(
  event: CalendarEvent,
  offsetMs: number,
  defaults: AlarmCreationDefaults,
): Alarm {
  const id = generateAlarmId();
  const now = Date.now();

  return {
    id,
    label: event.title,
    enabled: true,
    targetTimestampMs: event.startTimestampMs + offsetMs,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: defaults.dismissalMethod,
    gradualVolumeDurationSec: defaults.gradualVolumeDurationSec,
    snoozeDurationMin: defaults.snoozeDurationMin,
    snoozeMaxCount: defaults.snoozeMaxCount,
    snoozeCount: 0,
    autoSilenceMin: 5,
    soundUri: null,
    vibrationEnabled: defaults.vibrationEnabled,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: event.id,
    linkedEventOffsetMs: offsetMs,
    mathDifficulty: defaults.mathDifficulty,
    lastFiredAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function generateAlarmId(): string {
  return `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
