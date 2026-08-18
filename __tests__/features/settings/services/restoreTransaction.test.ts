import { STORAGE_KEYS } from "../../../../src/core/storage/keys";
import { createDefaultStore } from "../../../../src/features/game2048/logic/gameEngine";
import {
  BackupRestoreTransactionError,
  recoverPendingBackupRestore,
  restoreBackupTransaction,
  type RestoreSnapshot,
  waitForRestoreWrites,
} from "../../../../src/features/settings/services/restoreTransaction";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

const mockStorage: Record<string, string> = {};
const mockRestoreAlarmSchedules = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage[key] ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

jest.mock("../../../../src/features/settings/services/restoreAlarms", () => ({
  AlarmRestoreError: class AlarmRestoreError extends Error {
    constructor(mockRecoveredAlarms: unknown[]) {
      super("Unable to restore alarm schedules");
      Object.assign(this, { recoveredAlarms: mockRecoveredAlarms });
    }
  },
  restoreAlarmSchedules: (...args: unknown[]) =>
    mockRestoreAlarmSchedules(...args),
}));

function createSnapshot(id: string): RestoreSnapshot {
  return {
    settings: DEFAULT_SETTINGS,
    alarms: [
      {
        id,
        label: id,
        enabled: true,
        targetTimestampMs: 2_000_000_000_000,
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
        notifeeTriggerId: null,
        skipNextOccurrence: false,
        linkedCalendarEventId: null,
        linkedEventOffsetMs: 0,
        mathDifficulty: 1,
        lastFiredAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    sleepSessions: [],
    game2048: createDefaultStore(),
  };
}

describe("backup restore transaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    mockRestoreAlarmSchedules.mockReset();
  });

  it("clears its journal after every state write succeeds", async () => {
    const previous = createSnapshot("previous");
    const next = createSnapshot("next");
    const scheduled = [{ ...next.alarms[0], notifeeTriggerId: "next-trigger" }];
    const applySnapshot = jest.fn().mockResolvedValue(undefined);
    mockRestoreAlarmSchedules.mockResolvedValue(scheduled);

    const result = await restoreBackupTransaction(
      previous,
      next,
      applySnapshot,
    );

    expect(result.alarms).toEqual(scheduled);
    expect(applySnapshot).toHaveBeenCalledWith({ ...next, alarms: scheduled });
    expect(mockStorage[STORAGE_KEYS.PENDING_BACKUP_RESTORE]).toBeUndefined();
  });

  it("rolls back state and schedules when a persisted atom write fails", async () => {
    const previous = createSnapshot("previous");
    const next = createSnapshot("next");
    const scheduledNext = [
      { ...next.alarms[0], notifeeTriggerId: "next-trigger" },
    ];
    const recovered = [
      { ...previous.alarms[0], notifeeTriggerId: "previous-trigger" },
    ];
    const applySnapshot = jest
      .fn()
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce(undefined);
    mockRestoreAlarmSchedules
      .mockResolvedValueOnce(scheduledNext)
      .mockResolvedValueOnce(recovered);

    await expect(
      restoreBackupTransaction(previous, next, applySnapshot),
    ).rejects.toBeInstanceOf(BackupRestoreTransactionError);

    expect(mockRestoreAlarmSchedules).toHaveBeenNthCalledWith(
      2,
      scheduledNext,
      previous.alarms,
      next.settings.cycleConfig,
      previous.settings.cycleConfig,
    );
    expect(applySnapshot).toHaveBeenLastCalledWith({
      ...previous,
      alarms: recovered,
    });
    expect(mockStorage[STORAGE_KEYS.PENDING_BACKUP_RESTORE]).toBeUndefined();
  });

  it("waits for every failed restore write before starting rollback", async () => {
    const previous = createSnapshot("previous");
    const next = createSnapshot("next");
    const scheduledNext = [
      { ...next.alarms[0], notifeeTriggerId: "next-trigger" },
    ];
    const recovered = [
      { ...previous.alarms[0], notifeeTriggerId: "previous-trigger" },
    ];
    let finishDelayedWrite: (() => void) | undefined;
    const delayedWrite = new Promise<void>((resolve) => {
      finishDelayedWrite = resolve;
    });
    const applySnapshot = jest.fn((snapshot: RestoreSnapshot) => {
      if (snapshot.alarms[0].id === "next") {
        return waitForRestoreWrites([
          Promise.reject(new Error("settings write failed")),
          delayedWrite,
        ]);
      }
      return Promise.resolve();
    });
    mockRestoreAlarmSchedules
      .mockResolvedValueOnce(scheduledNext)
      .mockResolvedValueOnce(recovered);

    const restore = restoreBackupTransaction(previous, next, applySnapshot);

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(applySnapshot).toHaveBeenCalledTimes(1);

    finishDelayedWrite?.();

    await expect(restore).rejects.toBeInstanceOf(BackupRestoreTransactionError);
    expect(applySnapshot).toHaveBeenCalledWith({
      ...previous,
      alarms: recovered,
    });
  });

  it("finishes a scheduled restore after an interrupted process", async () => {
    const previous = createSnapshot("previous");
    const next = createSnapshot("next");
    const scheduled = [{ ...next.alarms[0], notifeeTriggerId: "next-trigger" }];
    mockStorage[STORAGE_KEYS.PENDING_BACKUP_RESTORE] = JSON.stringify({
      version: 1,
      phase: "scheduled",
      previous,
      next,
    });
    const applySnapshot = jest.fn().mockResolvedValue(undefined);
    mockRestoreAlarmSchedules.mockResolvedValue(scheduled);

    const result = await recoverPendingBackupRestore(applySnapshot);

    expect(result).toEqual({ ...next, alarms: scheduled });
    expect(mockRestoreAlarmSchedules).toHaveBeenCalledWith(
      previous.alarms,
      next.alarms,
      previous.settings.cycleConfig,
      next.settings.cycleConfig,
    );
    expect(mockStorage[STORAGE_KEYS.PENDING_BACKUP_RESTORE]).toBeUndefined();
  });

  it("rolls back a restore interrupted before scheduling completed", async () => {
    const previous = createSnapshot("previous");
    const next = createSnapshot("next");
    const recovered = [
      { ...previous.alarms[0], notifeeTriggerId: "previous-trigger" },
    ];
    mockStorage[STORAGE_KEYS.PENDING_BACKUP_RESTORE] = JSON.stringify({
      version: 1,
      phase: "prepared",
      previous,
      next,
    });
    const applySnapshot = jest.fn().mockResolvedValue(undefined);
    mockRestoreAlarmSchedules.mockResolvedValue(recovered);

    const result = await recoverPendingBackupRestore(applySnapshot);

    expect(result).toEqual({ ...previous, alarms: recovered });
    expect(mockRestoreAlarmSchedules).toHaveBeenCalledWith(
      next.alarms,
      previous.alarms,
      next.settings.cycleConfig,
      previous.settings.cycleConfig,
    );
    expect(mockStorage[STORAGE_KEYS.PENDING_BACKUP_RESTORE]).toBeUndefined();
  });
});
