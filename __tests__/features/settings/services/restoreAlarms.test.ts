import { getAlarmToSchedule } from "../../../../src/features/alarm/services/alarmRescheduler";
import {
  cancelAlarm,
  scheduleAlarm,
} from "../../../../src/features/alarm/services/alarmScheduler";
import {
  AlarmRestoreError,
  restoreAlarmSchedules,
} from "../../../../src/features/settings/services/restoreAlarms";
import type { Alarm } from "../../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

jest.mock("../../../../src/features/alarm/services/alarmScheduler", () => ({
  cancelAlarm: jest.fn().mockResolvedValue(undefined),
  scheduleAlarm: jest.fn().mockResolvedValue("trigger"),
}));

jest.mock("../../../../src/features/alarm/services/alarmRescheduler", () => ({
  getAlarmToSchedule: jest.fn((alarm) => alarm),
}));

const mockCancelAlarm = cancelAlarm as jest.MockedFunction<typeof cancelAlarm>;
const mockScheduleAlarm = scheduleAlarm as jest.MockedFunction<
  typeof scheduleAlarm
>;
const mockGetAlarmToSchedule = getAlarmToSchedule as jest.MockedFunction<
  typeof getAlarmToSchedule
>;

function createAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "Wake up",
    enabled: true,
    targetTimestampMs: Date.now() + 60 * 60 * 1000,
    recurrenceAnchorTimestampMs: null,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 0,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: "old-trigger",
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    activeOccurrenceTimestampMs: null,
    lastDeliveredOccurrenceTimestampMs: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("restoreAlarmSchedules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelAlarm.mockResolvedValue(undefined);
    mockScheduleAlarm.mockResolvedValue("trigger");
    mockGetAlarmToSchedule.mockImplementation((alarm) => alarm);
  });

  it("cancels old schedules before scheduling restored alarms with the restored cycle", async () => {
    const current = createAlarm();
    const restored = createAlarm({ notifeeTriggerId: "stale-trigger" });

    const result = await restoreAlarmSchedules(
      [current],
      [restored],
      DEFAULT_SETTINGS.cycleConfig,
      DEFAULT_SETTINGS.cycleConfig,
    );

    expect(mockCancelAlarm).toHaveBeenCalledWith(current);
    expect(mockGetAlarmToSchedule).toHaveBeenCalledWith(
      restored,
      DEFAULT_SETTINGS.cycleConfig,
      expect.any(Number),
    );
    expect(mockScheduleAlarm).toHaveBeenCalledWith(
      restored,
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(result).toEqual([
      {
        ...restored,
        notifeeTriggerId: "trigger",
        updatedAt: expect.any(Number),
      },
    ]);
  });

  it("cancels newly scheduled restored alarms and recovers old schedules after a partial failure", async () => {
    const current = createAlarm();
    const first = createAlarm({ id: "restored-1" });
    const second = createAlarm({ id: "restored-2" });
    const currentCycleConfig = {
      ...DEFAULT_SETTINGS.cycleConfig,
      cycleLengthMinutes: 1440,
    };
    mockScheduleAlarm
      .mockResolvedValueOnce("new-trigger")
      .mockRejectedValueOnce(new Error("cannot schedule"))
      .mockResolvedValueOnce("recovered-trigger");

    let error: unknown;
    try {
      await restoreAlarmSchedules(
        [current],
        [first, second],
        currentCycleConfig,
        DEFAULT_SETTINGS.cycleConfig,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AlarmRestoreError);
    expect(mockCancelAlarm).toHaveBeenNthCalledWith(1, current);
    expect(mockCancelAlarm).toHaveBeenNthCalledWith(2, {
      ...first,
      notifeeTriggerId: "new-trigger",
      updatedAt: expect.any(Number),
    });
    expect(mockCancelAlarm).toHaveBeenNthCalledWith(3, current);
    expect(mockScheduleAlarm).toHaveBeenLastCalledWith(
      current,
      currentCycleConfig,
    );
    expect(mockGetAlarmToSchedule).toHaveBeenLastCalledWith(
      current,
      currentCycleConfig,
      expect.any(Number),
    );
    expect((error as AlarmRestoreError).recoveredAlarms).toEqual([
      {
        ...current,
        notifeeTriggerId: "recovered-trigger",
        updatedAt: expect.any(Number),
      },
    ]);
  });

  it("marks an alarm disabled when rollback cannot reschedule it", async () => {
    const current = createAlarm();
    const restored = createAlarm({ id: "restored" });
    mockScheduleAlarm
      .mockRejectedValueOnce(new Error("cannot schedule restored"))
      .mockRejectedValueOnce(new Error("cannot recover current"));

    await expect(
      restoreAlarmSchedules(
        [current],
        [restored],
        DEFAULT_SETTINGS.cycleConfig,
        DEFAULT_SETTINGS.cycleConfig,
      ),
    ).rejects.toMatchObject({
      recoveredAlarms: [{ ...current, enabled: false, notifeeTriggerId: null }],
    });
  });

  it("retries cancellation for a disabled alarm with a trigger before rollback", async () => {
    const disabled = createAlarm({
      enabled: false,
      notifeeTriggerId: "disabled-trigger",
    });
    mockCancelAlarm
      .mockRejectedValueOnce(new Error("first cancel failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      restoreAlarmSchedules(
        [disabled],
        [],
        DEFAULT_SETTINGS.cycleConfig,
        DEFAULT_SETTINGS.cycleConfig,
      ),
    ).rejects.toMatchObject({
      recoveredAlarms: [{ ...disabled, notifeeTriggerId: null }],
    });

    expect(mockCancelAlarm).toHaveBeenNthCalledWith(1, disabled);
    expect(mockCancelAlarm).toHaveBeenNthCalledWith(2, disabled);
  });
});
