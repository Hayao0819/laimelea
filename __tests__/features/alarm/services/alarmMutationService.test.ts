import {
  AlarmMutationError,
  replaceAlarmSchedule,
  scheduleAlarmBatch,
  setAlarmEnabled,
  skipNextAlarmOccurrence,
} from "../../../../src/features/alarm/services/alarmMutationService";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../../../../src/features/alarm/services/alarmScheduler";
import type { Alarm } from "../../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

jest.mock("../../../../src/features/alarm/services/alarmScheduler", () => ({
  cancelAlarm: jest.fn(),
  recoverAlarmSchedule: jest.fn(),
  scheduleAlarm: jest.fn(),
}));

const cycleConfig = DEFAULT_SETTINGS.cycleConfig;
const now = 1_800_000_000_000;

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "Alarm",
    enabled: true,
    targetTimestampMs: now + 60_000,
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
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("alarmMutationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cancelAlarm as jest.Mock).mockResolvedValue(undefined);
    (scheduleAlarm as jest.Mock).mockResolvedValue("new-trigger");
  });

  it("moves an expired repeating alarm forward before enabling it", async () => {
    const alarm = makeAlarm({
      enabled: false,
      targetTimestampMs: now - 90_000,
      repeat: { type: "interval", intervalMs: 60_000 },
    });

    const result = await setAlarmEnabled(alarm, true, cycleConfig, now);

    expect(result).toEqual(
      expect.objectContaining({
        enabled: true,
        targetTimestampMs: now + 30_000,
        notifeeTriggerId: "new-trigger",
      }),
    );
    expect(scheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ targetTimestampMs: now + 30_000 }),
      cycleConfig,
    );
  });

  it("returns the recovered alarm when cancellation fails", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const recovered = makeAlarm({ notifeeTriggerId: "recovered-trigger" });
    (cancelAlarm as jest.Mock).mockRejectedValueOnce(
      new Error("cancel failed"),
    );
    (recoverAlarmSchedule as jest.Mock).mockResolvedValueOnce(recovered);

    const promise = setAlarmEnabled(alarm, false, cycleConfig, now);

    await expect(promise).rejects.toMatchObject({
      failure: "cancel-failed",
      recoveredAlarm: recovered,
    });
    expect(recoverAlarmSchedule).toHaveBeenCalledWith(alarm, now, cycleConfig);
  });

  it("restores the previous schedule when replacement fails", async () => {
    const previous = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const next = makeAlarm({ label: "Updated", notifeeTriggerId: null });
    const recovered = makeAlarm({ notifeeTriggerId: "recovered-trigger" });
    (scheduleAlarm as jest.Mock).mockRejectedValueOnce(new Error("failed"));
    (recoverAlarmSchedule as jest.Mock).mockResolvedValueOnce(recovered);

    await expect(
      replaceAlarmSchedule(previous, next, cycleConfig, now),
    ).rejects.toMatchObject({
      failure: "schedule-failed",
      recoveredAlarm: recovered,
    });
    expect(cancelAlarm).toHaveBeenCalledWith(previous);
    expect(recoverAlarmSchedule).toHaveBeenCalledWith(
      previous,
      now,
      cycleConfig,
    );
  });

  it("rejects skipping a non-repeating alarm without cancelling it", async () => {
    const alarm = makeAlarm({
      targetTimestampMs: now - 1,
      repeat: null,
    });

    await expect(
      skipNextAlarmOccurrence(alarm, cycleConfig, now),
    ).rejects.toEqual(expect.any(AlarmMutationError));
    expect(cancelAlarm).not.toHaveBeenCalled();
    expect(scheduleAlarm).not.toHaveBeenCalled();
  });

  it("rolls back every attempted alarm after a batch failure", async () => {
    const alarms = [
      makeAlarm({ id: "first" }),
      makeAlarm({ id: "second" }),
      makeAlarm({ id: "third" }),
    ];
    (scheduleAlarm as jest.Mock)
      .mockResolvedValueOnce("first-trigger")
      .mockResolvedValueOnce("second-trigger")
      .mockRejectedValueOnce(new Error("failed"));

    await expect(scheduleAlarmBatch(alarms, cycleConfig)).rejects.toMatchObject(
      {
        failure: "schedule-failed",
      },
    );

    expect(cancelAlarm).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "first",
        notifeeTriggerId: "first-trigger",
      }),
    );
    expect(cancelAlarm).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "second",
        notifeeTriggerId: "second-trigger",
      }),
    );
    expect(cancelAlarm).toHaveBeenNthCalledWith(3, alarms[2]);
  });

  it("returns alarms whose rollback could not be confirmed", async () => {
    const alarms = [makeAlarm({ id: "first" }), makeAlarm({ id: "second" })];
    (scheduleAlarm as jest.Mock)
      .mockResolvedValueOnce("first-trigger")
      .mockRejectedValueOnce(new Error("failed"));
    (cancelAlarm as jest.Mock)
      .mockRejectedValueOnce(new Error("cancel failed"))
      .mockResolvedValueOnce(undefined);

    await expect(scheduleAlarmBatch(alarms, cycleConfig)).rejects.toMatchObject(
      {
        failure: "schedule-failed",
        retainedAlarms: [
          expect.objectContaining({
            id: "first",
            notifeeTriggerId: "first-trigger",
          }),
        ],
      },
    );
  });
});
