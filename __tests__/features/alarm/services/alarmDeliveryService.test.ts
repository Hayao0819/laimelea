import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../../src/core/storage/keys";
import { processAlarmDelivery } from "../../../../src/features/alarm/services/alarmDeliveryService";
import { scheduleNextAlarmOccurrence } from "../../../../src/features/alarm/services/alarmRescheduler";
import type { Alarm } from "../../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

const mockStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage.get(key) ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

jest.mock("../../../../src/features/alarm/services/alarmRescheduler", () => ({
  scheduleNextAlarmOccurrence: jest.fn(),
}));

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "Alarm",
    enabled: true,
    targetTimestampMs: 1_000_000,
    setInTimeSystem: "24h",
    repeat: { type: "interval", intervalMs: 60_000 },
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 15,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: "current-trigger",
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function storeAlarms(alarms: Alarm[]): void {
  mockStorage.set(STORAGE_KEYS.ALARMS, JSON.stringify(alarms));
}

describe("processAlarmDelivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockStorage.set(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    (scheduleNextAlarmOccurrence as jest.Mock).mockImplementation(
      async (alarm: Alarm) => ({
        ...alarm,
        targetTimestampMs: alarm.targetTimestampMs + 60_000,
        notifeeTriggerId: "next-trigger",
      }),
    );
  });

  it("schedules and persists the next occurrence", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      { alarmId: alarm.id, occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(result.handled).toBe(true);
    expect(scheduleNextAlarmOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: alarm.id,
        targetTimestampMs: 1_000_000,
      }),
      DEFAULT_SETTINGS.cycleConfig,
      1_000_100,
    );
    expect(result.updatedAlarm).toMatchObject({
      targetTimestampMs: 1_060_000,
      activeOccurrenceTimestampMs: 1_000_000,
      lastDeliveredOccurrenceTimestampMs: 1_000_000,
      notifeeTriggerId: "next-trigger",
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ALARMS,
      expect.any(String),
    );
  });

  it("uses persisted cycle settings", async () => {
    const alarm = makeAlarm({
      repeat: { type: "customCycleInterval", customCycleIntervalDays: 2 },
    });
    storeAlarms([alarm]);
    mockStorage.set(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({
        cycleConfig: { cycleLengthMinutes: 1_500, baseTimeMs: 5 },
      }),
    );

    await processAlarmDelivery(
      { alarmId: alarm.id, occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(scheduleNextAlarmOccurrence).toHaveBeenCalledWith(
      expect.any(Object),
      { cycleLengthMinutes: 1_500, baseTimeMs: 5 },
      1_000_100,
    );
  });

  it("handles the same delivered occurrence only once", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);
    const data = { alarmId: alarm.id, occurrenceTimestampMs: "1000000" };

    const first = await processAlarmDelivery(data, undefined, 1_000_100);
    const second = await processAlarmDelivery(data, undefined, 1_000_200);

    expect(first.handled).toBe(true);
    expect(second.handled).toBe(false);
    expect(scheduleNextAlarmOccurrence).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("clears an active occurrence when its later stop delivery arrives", async () => {
    const alarm = makeAlarm({
      targetTimestampMs: 1_060_000,
      activeOccurrenceTimestampMs: 1_000_000,
      lastDeliveredOccurrenceTimestampMs: 1_000_000,
    });
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      {
        alarmId: alarm.id,
        occurrenceTimestampMs: 1_000_000,
        stopped: true,
      },
      undefined,
      1_000_200,
    );

    expect(result).toMatchObject({
      handled: true,
      updatedAlarm: {
        id: alarm.id,
        activeOccurrenceTimestampMs: null,
        lastDeliveredOccurrenceTimestampMs: 1_000_000,
        targetTimestampMs: 1_060_000,
      },
    });
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
  });

  it("reschedules a stopped occurrence without keeping it active", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      {
        alarmId: alarm.id,
        occurrenceTimestampMs: 1_000_000,
        stopped: true,
      },
      undefined,
      1_000_200,
    );

    expect(result.updatedAlarm).toMatchObject({
      activeOccurrenceTimestampMs: null,
      lastDeliveredOccurrenceTimestampMs: 1_000_000,
      targetTimestampMs: 1_060_000,
    });
    expect(scheduleNextAlarmOccurrence).toHaveBeenCalledTimes(1);
  });

  it("reschedules an expired occurrence without keeping it active", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      {
        alarmId: alarm.id,
        occurrenceTimestampMs: 1_000_000,
        autoSilenceMs: 60_000,
      },
      undefined,
      1_060_000,
    );

    expect(result.updatedAlarm).toMatchObject({
      activeOccurrenceTimestampMs: null,
      lastDeliveredOccurrenceTimestampMs: 1_000_000,
      targetTimestampMs: 1_060_000,
    });
    expect(scheduleNextAlarmOccurrence).toHaveBeenCalledTimes(1);
  });

  it("clears an active occurrence for a disabled alarm when it is stopped", async () => {
    const alarm = makeAlarm({
      enabled: false,
      targetTimestampMs: 1_060_000,
      activeOccurrenceTimestampMs: 1_000_000,
      lastDeliveredOccurrenceTimestampMs: 1_000_000,
    });
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      {
        alarmId: alarm.id,
        occurrenceTimestampMs: 1_000_000,
        stopped: true,
      },
      undefined,
      1_000_200,
    );

    expect(result).toMatchObject({
      handled: true,
      updatedAlarm: {
        id: alarm.id,
        enabled: false,
        activeOccurrenceTimestampMs: null,
      },
    });
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
  });

  it("serializes concurrent duplicate delivery events", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);
    const data = { alarmId: alarm.id, occurrenceTimestampMs: "1000000" };

    const [first, second] = await Promise.all([
      processAlarmDelivery(data, undefined, 1_000_100),
      processAlarmDelivery(data, undefined, 1_000_100),
    ]);

    expect([first.handled, second.handled].sort()).toEqual([false, true]);
    expect(scheduleNextAlarmOccurrence).toHaveBeenCalledTimes(1);
  });

  it("keeps a delivered test alarm until the firing screen dismisses it", async () => {
    const alarm = makeAlarm({ isTest: true, repeat: null });
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      { alarmId: alarm.id, occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(result).toMatchObject({
      handled: true,
      alarms: [
        {
          id: alarm.id,
          activeOccurrenceTimestampMs: 1_000_000,
          lastDeliveredOccurrenceTimestampMs: 1_000_000,
        },
      ],
      updatedAlarm: {
        id: alarm.id,
        activeOccurrenceTimestampMs: 1_000_000,
        lastDeliveredOccurrenceTimestampMs: 1_000_000,
      },
    });
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
  });

  it.each([
    { stopped: true, autoSilenceMs: 0, now: 1_000_100 },
    { stopped: false, autoSilenceMs: 60_000, now: 1_060_000 },
  ])("removes an inactive delivered test alarm", async (delivery) => {
    const alarm = makeAlarm({ isTest: true, repeat: null });
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      {
        alarmId: alarm.id,
        occurrenceTimestampMs: "1000000",
        stopped: delivery.stopped,
        autoSilenceMs: delivery.autoSilenceMs,
      },
      undefined,
      delivery.now,
    );

    expect(result).toMatchObject({
      handled: true,
      alarms: [],
      updatedAlarm: null,
    });
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
    expect(mockStorage.get(STORAGE_KEYS.ALARMS)).toBe("[]");
  });

  it("falls back to the stored target for an older notification", async () => {
    const alarm = makeAlarm({ targetTimestampMs: 2_000_000 });
    storeAlarms([alarm]);

    const result = await processAlarmDelivery(
      { alarmId: alarm.id },
      undefined,
      2_000_100,
    );

    expect(result.updatedAlarm?.activeOccurrenceTimestampMs).toBe(2_000_000);
  });

  it("passes updated alarms to a foreground synchronization callback", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);
    const onAlarmsUpdated = jest.fn();

    await processAlarmDelivery(
      { alarmId: alarm.id, occurrenceTimestampMs: "1000000" },
      onAlarmsUpdated,
      1_000_100,
    );

    expect(onAlarmsUpdated).toHaveBeenCalledWith([
      expect.objectContaining({
        id: alarm.id,
        activeOccurrenceTimestampMs: 1_000_000,
      }),
    ]);
  });

  it("persists a disabled occurrence when scheduling the next one fails", async () => {
    const alarm = makeAlarm();
    storeAlarms([alarm]);
    (scheduleNextAlarmOccurrence as jest.Mock).mockRejectedValue(
      new Error("schedule failed"),
    );

    const result = await processAlarmDelivery(
      { alarmId: alarm.id, occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(result).toMatchObject({
      handled: true,
      rescheduleFailed: true,
      updatedAlarm: {
        enabled: false,
        activeOccurrenceTimestampMs: 1_000_000,
        lastDeliveredOccurrenceTimestampMs: 1_000_000,
      },
    });
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("ignores delivery from an alarm that was already disabled", async () => {
    storeAlarms([makeAlarm({ enabled: false })]);

    const result = await processAlarmDelivery(
      { alarmId: "alarm-1", occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(result.handled).toBe(false);
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
  });

  it("ignores corrupt alarm storage without failing the background task", async () => {
    mockStorage.set(STORAGE_KEYS.ALARMS, "not-json");

    await expect(
      processAlarmDelivery(
        { alarmId: "alarm-1", occurrenceTimestampMs: "1000000" },
        undefined,
        1_000_100,
      ),
    ).resolves.toMatchObject({ handled: false });
  });

  it("ignores invalid or unknown alarm IDs", async () => {
    storeAlarms([makeAlarm()]);

    const invalid = await processAlarmDelivery({}, undefined, 1_000_100);
    const missing = await processAlarmDelivery(
      { alarmId: "missing", occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(invalid.handled).toBe(false);
    expect(missing.handled).toBe(false);
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
  });

  it("ignores disabled alarms and stale delivered notifications", async () => {
    const disabledAlarm = makeAlarm({ id: "disabled", enabled: false });
    const editedAlarm = makeAlarm({
      id: "edited",
      targetTimestampMs: 2_000_000,
    });
    storeAlarms([disabledAlarm, editedAlarm]);

    const disabled = await processAlarmDelivery(
      { alarmId: disabledAlarm.id, occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );
    const stale = await processAlarmDelivery(
      { alarmId: editedAlarm.id, occurrenceTimestampMs: "1000000" },
      undefined,
      1_000_100,
    );

    expect(disabled.handled).toBe(false);
    expect(stale.handled).toBe(false);
    expect(scheduleNextAlarmOccurrence).not.toHaveBeenCalled();
  });
});
