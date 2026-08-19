import { isSameAlarmState } from "../../../../src/features/alarm/services/alarmStateVersion";
import type { Alarm } from "../../../../src/models/Alarm";

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "Alarm",
    enabled: true,
    targetTimestampMs: 1_800_000_060_000,
    setInTimeSystem: "custom",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 15,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: "trigger-id",
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
    ...overrides,
  };
}

describe("isSameAlarmState", () => {
  it("matches omitted optional fields with their persisted null values", () => {
    const inMemory = makeAlarm();
    const persisted = makeAlarm({
      recurrenceAnchorTimestampMs: null,
      linkedCalendarSourceEventId: null,
      activeOccurrenceTimestampMs: null,
      lastDeliveredOccurrenceTimestampMs: null,
    });

    expect(isSameAlarmState(inMemory, persisted)).toBe(true);
  });

  it("does not match a concurrent edit", () => {
    const expected = makeAlarm();
    const concurrentEdit = makeAlarm({ label: "Changed" });

    expect(isSameAlarmState(expected, concurrentEdit)).toBe(false);
  });
});
