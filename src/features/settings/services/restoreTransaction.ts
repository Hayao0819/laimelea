import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import type { Alarm } from "../../../models/Alarm";
import type { AppSettings } from "../../../models/Settings";
import type { SleepSession } from "../../../models/SleepSession";
import type { Game2048Store } from "../../game2048/logic/gameTypes";
import { AlarmRestoreError, restoreAlarmSchedules } from "./restoreAlarms";

export interface RestoreSnapshot {
  settings: AppSettings;
  alarms: Alarm[];
  sleepSessions: SleepSession[];
  game2048: Game2048Store;
}

type PendingRestorePhase = "prepared" | "scheduled" | "rolling-back";

interface PendingRestore {
  version: 1;
  phase: PendingRestorePhase;
  previous: RestoreSnapshot;
  next: RestoreSnapshot;
}

export class BackupRestoreTransactionError extends Error {
  constructor(readonly recoveredSnapshot: RestoreSnapshot) {
    super("Unable to restore backup state");
    this.name = "BackupRestoreTransactionError";
  }
}

export type ApplyRestoreSnapshot = (snapshot: RestoreSnapshot) => Promise<void>;

export async function waitForRestoreWrites(
  writes: readonly Promise<unknown>[],
): Promise<void> {
  const results = await Promise.allSettled(writes);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (rejected) throw rejected.reason;
}

function isRestoreSnapshot(value: unknown): value is RestoreSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.settings === "object" &&
    snapshot.settings !== null &&
    Array.isArray(snapshot.alarms) &&
    Array.isArray(snapshot.sleepSessions) &&
    typeof snapshot.game2048 === "object" &&
    snapshot.game2048 !== null
  );
}

async function readPendingRestore(): Promise<PendingRestore | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_BACKUP_RESTORE);
  if (raw == null) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const pending = value as Record<string, unknown>;
    if (
      pending.version !== 1 ||
      (pending.phase !== "prepared" &&
        pending.phase !== "scheduled" &&
        pending.phase !== "rolling-back") ||
      !isRestoreSnapshot(pending.previous) ||
      !isRestoreSnapshot(pending.next)
    ) {
      return null;
    }
    return pending as unknown as PendingRestore;
  } catch {
    return null;
  }
}

async function writePendingRestore(pending: PendingRestore): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.PENDING_BACKUP_RESTORE,
    JSON.stringify(pending),
  );
}

async function clearPendingRestore(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_BACKUP_RESTORE);
}

async function recoverAlarmSchedules(
  source: RestoreSnapshot,
  target: RestoreSnapshot,
): Promise<Alarm[]> {
  try {
    return await restoreAlarmSchedules(
      source.alarms,
      target.alarms,
      source.settings.cycleConfig,
      target.settings.cycleConfig,
    );
  } catch (error) {
    if (error instanceof AlarmRestoreError) return error.recoveredAlarms;
    throw error;
  }
}

export async function restoreBackupTransaction(
  previous: RestoreSnapshot,
  next: RestoreSnapshot,
  applySnapshot: ApplyRestoreSnapshot,
): Promise<RestoreSnapshot> {
  let pending: PendingRestore = {
    version: 1,
    phase: "prepared",
    previous,
    next,
  };
  await writePendingRestore(pending);

  let scheduledNext: RestoreSnapshot | null = null;
  try {
    scheduledNext = {
      ...next,
      alarms: await restoreAlarmSchedules(
        previous.alarms,
        next.alarms,
        previous.settings.cycleConfig,
        next.settings.cycleConfig,
      ),
    };
    pending = { ...pending, phase: "scheduled", next: scheduledNext };
    await writePendingRestore(pending);
    await applySnapshot(scheduledNext);
    await clearPendingRestore();
    return scheduledNext;
  } catch (error) {
    const recoveredAlarms =
      error instanceof AlarmRestoreError
        ? error.recoveredAlarms
        : await recoverAlarmSchedules(scheduledNext ?? next, previous);
    const recoveredSnapshot = { ...previous, alarms: recoveredAlarms };

    try {
      await writePendingRestore({
        ...pending,
        phase: "rolling-back",
        previous: recoveredSnapshot,
      });
      await applySnapshot(recoveredSnapshot);
      await clearPendingRestore();
    } catch {}

    throw new BackupRestoreTransactionError(recoveredSnapshot);
  }
}

export async function recoverPendingBackupRestore(
  applySnapshot: ApplyRestoreSnapshot,
): Promise<RestoreSnapshot | null> {
  const pending = await readPendingRestore();
  if (pending == null) return null;

  const target =
    pending.phase === "scheduled" ? pending.next : pending.previous;
  const source =
    pending.phase === "scheduled" ? pending.previous : pending.next;
  const recoveredSnapshot = {
    ...target,
    alarms: await recoverAlarmSchedules(source, target),
  };
  await applySnapshot(recoveredSnapshot);
  await clearPendingRestore();
  return recoveredSnapshot;
}
