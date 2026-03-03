import type { AlarmCreationDefaults } from "../../../src/core/calendar/calendarAlarmSync";
import {
  createAlarmFromEvent,
  syncCalendarAlarms,
} from "../../../src/core/calendar/calendarAlarmSync";
import type { Alarm } from "../../../src/models/Alarm";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    sourceEventId: "source-evt-1",
    source: "google",
    title: "Team Meeting",
    description: "",
    startTimestampMs: 1700000000000,
    endTimestampMs: 1700003600000,
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "Team Meeting",
    enabled: true,
    targetTimestampMs: 1700000000000 - 900000,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 5,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: "evt-1",
    linkedEventOffsetMs: -900000,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: 1699999000000,
    updatedAt: 1699999000000,
    ...overrides,
  };
}

const defaultAlarmDefaults: AlarmCreationDefaults = {
  dismissalMethod: "simple",
  gradualVolumeDurationSec: 30,
  snoozeDurationMin: 5,
  snoozeMaxCount: 3,
  vibrationEnabled: true,
  mathDifficulty: 1,
};

describe("syncCalendarAlarms", () => {
  it("should update alarm when event start time changes", () => {
    const alarm = makeAlarm({
      targetTimestampMs: 1700000000000 - 900000,
      linkedCalendarEventId: "evt-1",
      linkedEventOffsetMs: -900000,
    });
    const event = makeEvent({
      id: "evt-1",
      startTimestampMs: 1700010000000,
    });

    const result = syncCalendarAlarms([alarm], [event]);

    expect(result.updatedAlarms).toHaveLength(1);
    expect(result.updatedAlarms[0].targetTimestampMs).toBe(
      1700010000000 - 900000,
    );
    expect(result.updatedAlarms[0].updatedAt).toBeGreaterThan(alarm.updatedAt);
    expect(result.orphanedAlarmIds).toHaveLength(0);
  });

  it("should not modify alarm when event time is unchanged", () => {
    const alarm = makeAlarm({
      targetTimestampMs: 1700000000000 - 900000,
      linkedCalendarEventId: "evt-1",
      linkedEventOffsetMs: -900000,
    });
    const event = makeEvent({
      id: "evt-1",
      startTimestampMs: 1700000000000,
    });

    const result = syncCalendarAlarms([alarm], [event]);

    expect(result.updatedAlarms).toHaveLength(1);
    expect(result.updatedAlarms[0]).toBe(alarm);
    expect(result.orphanedAlarmIds).toHaveLength(0);
  });

  it("should mark alarm as orphaned when linked event is deleted", () => {
    const alarm = makeAlarm({
      id: "alarm-orphan",
      linkedCalendarEventId: "evt-deleted",
    });

    const result = syncCalendarAlarms([alarm], []);

    expect(result.orphanedAlarmIds).toEqual(["alarm-orphan"]);
    expect(result.updatedAlarms).toHaveLength(1);
    expect(result.updatedAlarms[0]).toBe(alarm);
  });

  it("should keep non-linked alarms unchanged", () => {
    const alarm = makeAlarm({
      linkedCalendarEventId: null,
      linkedEventOffsetMs: 0,
    });

    const result = syncCalendarAlarms([alarm], []);

    expect(result.updatedAlarms).toHaveLength(1);
    expect(result.updatedAlarms[0]).toBe(alarm);
    expect(result.orphanedAlarmIds).toHaveLength(0);
  });

  it("should apply offset correctly (e.g., -15 min = -900000ms)", () => {
    const offsetMs = -900000;
    const eventStart = 1700000000000;
    const alarm = makeAlarm({
      targetTimestampMs: eventStart + offsetMs,
      linkedCalendarEventId: "evt-1",
      linkedEventOffsetMs: offsetMs,
    });
    const event = makeEvent({
      id: "evt-1",
      startTimestampMs: eventStart + 3600000,
    });

    const result = syncCalendarAlarms([alarm], [event]);

    expect(result.updatedAlarms[0].targetTimestampMs).toBe(
      eventStart + 3600000 + offsetMs,
    );
  });

  it("should handle empty alarms and events arrays", () => {
    const result = syncCalendarAlarms([], []);

    expect(result.updatedAlarms).toEqual([]);
    expect(result.orphanedAlarmIds).toEqual([]);
  });

  it("should match by sourceEventId in addition to event id", () => {
    const alarm = makeAlarm({
      linkedCalendarEventId: "source-evt-1",
      linkedEventOffsetMs: 0,
      targetTimestampMs: 1700000000000,
    });
    const event = makeEvent({
      id: "google-cal1-evt1",
      sourceEventId: "source-evt-1",
      startTimestampMs: 1700010000000,
    });

    const result = syncCalendarAlarms([alarm], [event]);

    expect(result.updatedAlarms).toHaveLength(1);
    expect(result.updatedAlarms[0].targetTimestampMs).toBe(1700010000000);
    expect(result.orphanedAlarmIds).toHaveLength(0);
  });

  it("should match by event id (composite Google Calendar ID)", () => {
    const alarm = makeAlarm({
      linkedCalendarEventId: "google-cal1-evt1",
      linkedEventOffsetMs: -600000,
      targetTimestampMs: 1700000000000 - 600000,
    });
    const event = makeEvent({
      id: "google-cal1-evt1",
      sourceEventId: "evt1",
      startTimestampMs: 1700020000000,
    });

    const result = syncCalendarAlarms([alarm], [event]);

    expect(result.updatedAlarms).toHaveLength(1);
    expect(result.updatedAlarms[0].targetTimestampMs).toBe(
      1700020000000 - 600000,
    );
    expect(result.orphanedAlarmIds).toHaveLength(0);
  });
});

describe("createAlarmFromEvent", () => {
  it("should create alarm with correct fields from event", () => {
    const event = makeEvent({
      id: "evt-new",
      title: "Standup",
      startTimestampMs: 1700100000000,
    });
    const offsetMs = -300000;

    const now = Date.now();
    const alarm = createAlarmFromEvent(event, offsetMs, defaultAlarmDefaults);

    expect(alarm.id).toMatch(/^alarm-\d+-[a-z0-9]+$/);
    expect(alarm.label).toBe("Standup");
    expect(alarm.enabled).toBe(true);
    expect(alarm.targetTimestampMs).toBe(1700100000000 - 300000);
    expect(alarm.setInTimeSystem).toBe("24h");
    expect(alarm.repeat).toBeNull();
    expect(alarm.dismissalMethod).toBe("simple");
    expect(alarm.gradualVolumeDurationSec).toBe(30);
    expect(alarm.snoozeDurationMin).toBe(5);
    expect(alarm.snoozeMaxCount).toBe(3);
    expect(alarm.snoozeCount).toBe(0);
    expect(alarm.autoSilenceMin).toBe(5);
    expect(alarm.soundUri).toBeNull();
    expect(alarm.vibrationEnabled).toBe(true);
    expect(alarm.notifeeTriggerId).toBeNull();
    expect(alarm.skipNextOccurrence).toBe(false);
    expect(alarm.linkedCalendarEventId).toBe("evt-new");
    expect(alarm.linkedEventOffsetMs).toBe(-300000);
    expect(alarm.lastFiredAt).toBeNull();
    expect(alarm.createdAt).toBeGreaterThanOrEqual(now);
    expect(alarm.updatedAt).toBe(alarm.createdAt);
  });

  describe("mathDifficulty", () => {
    it("should set mathDifficulty from defaults", () => {
      const event = makeEvent();
      const alarm = createAlarmFromEvent(event, -300000, defaultAlarmDefaults);

      expect(alarm.mathDifficulty).toBe(1);
    });

    it("should respect mathDifficulty=2 in defaults", () => {
      const event = makeEvent();
      const customDefaults: AlarmCreationDefaults = {
        ...defaultAlarmDefaults,
        mathDifficulty: 2,
      };
      const alarm = createAlarmFromEvent(event, -300000, customDefaults);

      expect(alarm.mathDifficulty).toBe(2);
    });

    it("should respect mathDifficulty=3 in defaults", () => {
      const event = makeEvent();
      const customDefaults: AlarmCreationDefaults = {
        ...defaultAlarmDefaults,
        mathDifficulty: 3,
      };
      const alarm = createAlarmFromEvent(event, -300000, customDefaults);

      expect(alarm.mathDifficulty).toBe(3);
    });
  });
});
