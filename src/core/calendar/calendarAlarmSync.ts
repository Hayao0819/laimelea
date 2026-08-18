import type { Alarm } from "../../models/Alarm";
import type { CalendarEvent } from "../../models/CalendarEvent";
import type { DismissalMethod, MathDifficulty } from "../../models/Settings";

export interface AlarmSyncResult {
  updatedAlarms: Alarm[];
  orphanedAlarmIds: string[];
}

const MAX_UNAMBIGUOUS_SINGLE_OCCURRENCE_MOVE_MS = 12 * 60 * 60 * 1000;

function findClosestOccurrence(
  alarm: Alarm,
  matchingOccurrences: CalendarEvent[],
): CalendarEvent | undefined {
  const expectedStartMs = alarm.targetTimestampMs - alarm.linkedEventOffsetMs;
  const sorted = [...matchingOccurrences].sort(
    (left, right) => left.startTimestampMs - right.startTimestampMs,
  );
  const closest = sorted.reduce((candidate, event) =>
    Math.abs(event.startTimestampMs - expectedStartMs) <
    Math.abs(candidate.startTimestampMs - expectedStartMs)
      ? event
      : candidate,
  );

  const distance = Math.abs(closest.startTimestampMs - expectedStartMs);
  if (distance === 0) return closest;
  if (sorted.length === 1) {
    return distance <= MAX_UNAMBIGUOUS_SINGLE_OCCURRENCE_MOVE_MS
      ? closest
      : undefined;
  }

  const minimumSpacing = sorted
    .slice(1)
    .reduce(
      (spacing, event, index) =>
        Math.min(
          spacing,
          event.startTimestampMs - sorted[index].startTimestampMs,
        ),
      Number.POSITIVE_INFINITY,
    );
  return distance < minimumSpacing / 2 ? closest : undefined;
}

export function findLinkedCalendarEvent(
  alarm: Alarm,
  events: CalendarEvent[],
): CalendarEvent | undefined {
  const linkedEvent = events.find(
    (event) => event.id === alarm.linkedCalendarEventId,
  );
  if (linkedEvent != null) return linkedEvent;

  const sourceEventId =
    alarm.linkedCalendarSourceEventId ?? alarm.linkedCalendarEventId;
  const matchingOccurrences = events.filter(
    (event) => event.sourceEventId === sourceEventId,
  );
  if (matchingOccurrences.length === 0) return undefined;

  return findClosestOccurrence(alarm, matchingOccurrences);
}

export function syncCalendarAlarms(
  alarms: Alarm[],
  events: CalendarEvent[],
): AlarmSyncResult {
  const updatedAlarms: Alarm[] = [];
  const orphanedAlarmIds: string[] = [];

  for (const alarm of alarms) {
    if (alarm.linkedCalendarEventId == null) {
      updatedAlarms.push(alarm);
      continue;
    }

    const event = findLinkedCalendarEvent(alarm, events);
    if (event == null) {
      orphanedAlarmIds.push(alarm.id);
      updatedAlarms.push(alarm);
      continue;
    }

    const newTargetMs = event.startTimestampMs + alarm.linkedEventOffsetMs;
    if (
      newTargetMs !== alarm.targetTimestampMs ||
      alarm.linkedCalendarEventId !== event.id ||
      alarm.linkedCalendarSourceEventId !== event.sourceEventId
    ) {
      updatedAlarms.push({
        ...alarm,
        targetTimestampMs: newTargetMs,
        linkedCalendarEventId: event.id,
        linkedCalendarSourceEventId: event.sourceEventId,
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
    linkedCalendarSourceEventId: event.sourceEventId,
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
