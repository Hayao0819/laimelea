import type { Alarm } from "../../../models/Alarm";

export function isSameAlarmState(left: Alarm, right: Alarm): boolean {
  return areEqual(normalizeOptionalState(left), normalizeOptionalState(right));
}

function normalizeOptionalState(alarm: Alarm): Alarm {
  return {
    ...alarm,
    recurrenceAnchorTimestampMs: alarm.recurrenceAnchorTimestampMs ?? null,
    repeat: alarm.repeat ?? null,
    linkedCalendarSourceEventId: alarm.linkedCalendarSourceEventId ?? null,
    activeOccurrenceTimestampMs: alarm.activeOccurrenceTimestampMs ?? null,
    lastDeliveredOccurrenceTimestampMs:
      alarm.lastDeliveredOccurrenceTimestampMs ?? null,
  };
}

function areEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => areEqual(item, right[index]))
    );
  }
  if (
    left == null ||
    right == null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([leftKey, leftValue], index) =>
        leftKey === rightEntries[index][0] &&
        areEqual(leftValue, rightEntries[index][1]),
    )
  );
}
