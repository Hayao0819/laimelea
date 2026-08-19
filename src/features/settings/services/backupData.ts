import {
  normalizeAlarm,
  normalizeSettings,
} from "../../../core/storage/appState";
import type { Alarm } from "../../../models/Alarm";
import type { AppSettings } from "../../../models/Settings";
import type { SleepSession, SleepStage } from "../../../models/SleepSession";
import { createDefaultStore } from "../../game2048/logic/gameEngine";
import type {
  BoardSize,
  Game2048Store,
  GameState,
} from "../../game2048/logic/gameTypes";

export interface BackupData {
  version: 1;
  timestamp: number;
  settings: AppSettings;
  alarms: Alarm[];
  sleepSessions: SleepSession[];
  game2048: Game2048Store;
}

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_ALARMS = 1_000;
const MAX_SLEEP_SESSIONS = 10_000;
const MAX_GAME_HISTORY = 1_000;
const MAX_GAME_SNAPSHOTS = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isTileValue(value: unknown): value is number {
  return (
    isNonNegativeInteger(value) &&
    (value === 0 || (value >= 2 && Number.isInteger(Math.log2(value))))
  );
}

function isOneOf<T extends string | number>(
  value: unknown,
  values: readonly T[],
): value is T {
  return (
    (typeof value === "string" || typeof value === "number") &&
    values.includes(value as T)
  );
}

function nullableString(value: unknown): string | null | undefined {
  return value == null || typeof value === "string" ? value : undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  return value == null || isFiniteNumber(value) ? value : undefined;
}

function normalizeStage(value: unknown): SleepStage | null {
  if (!isRecord(value)) return null;
  if (
    !isFiniteNumber(value.startTimestampMs) ||
    !isFiniteNumber(value.endTimestampMs) ||
    value.endTimestampMs < value.startTimestampMs ||
    !isOneOf(value.stage, [
      "unknown",
      "awake",
      "sleeping",
      "out_of_bed",
      "awake_in_bed",
      "light",
      "deep",
      "rem",
    ] as const)
  ) {
    return null;
  }
  return {
    startTimestampMs: value.startTimestampMs,
    endTimestampMs: value.endTimestampMs,
    stage: value.stage,
  };
}

function normalizeSleepSession(value: unknown): SleepSession | null {
  if (!isRecord(value) || !Array.isArray(value.stages)) return null;
  const startTimestampMs = value.startTimestampMs;
  const endTimestampMs = value.endTimestampMs;
  const durationMs = value.durationMs;
  const stages = value.stages.map(normalizeStage);
  if (
    stages.some((stage) => stage === null) ||
    typeof value.id !== "string" ||
    !isOneOf(value.source, ["health_connect", "manual"] as const) ||
    !isFiniteNumber(startTimestampMs) ||
    !isFiniteNumber(endTimestampMs) ||
    endTimestampMs < startTimestampMs ||
    !isFiniteNumber(durationMs) ||
    durationMs !== endTimestampMs - startTimestampMs ||
    stages.some(
      (stage) =>
        stage === null ||
        stage.startTimestampMs < startTimestampMs ||
        stage.endTimestampMs > endTimestampMs,
    ) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }
  return {
    id: value.id,
    source: value.source,
    startTimestampMs,
    endTimestampMs,
    stages: stages as SleepStage[],
    durationMs,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function isBoardSize(value: unknown): value is BoardSize {
  return value === 3 || value === 4 || value === 5 || value === 6;
}

function normalizeGameState(value: unknown): GameState | null {
  if (
    !isRecord(value) ||
    !isBoardSize(value.boardSize) ||
    !Array.isArray(value.board)
  ) {
    return null;
  }
  const boardSize = value.boardSize;
  if (
    value.board.length !== boardSize ||
    !value.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === boardSize &&
        row.every(isTileValue),
    ) ||
    !isNonNegativeInteger(value.score) ||
    !isNonNegativeInteger(value.moveCount) ||
    typeof value.isGameOver !== "boolean" ||
    typeof value.hasWon !== "boolean" ||
    typeof value.wonAcknowledged !== "boolean"
  ) {
    return null;
  }
  return {
    board: value.board.map((row) => [...row]) as number[][],
    score: value.score,
    boardSize: value.boardSize,
    isGameOver: value.isGameOver,
    hasWon: value.hasWon,
    wonAcknowledged: value.wonAcknowledged,
    moveCount: value.moveCount,
  };
}

function normalizeGameStore(value: unknown): Game2048Store | null {
  if (!isRecord(value)) return null;
  const currentGame = normalizeGameState(value.currentGame);
  if (
    !currentGame ||
    !Array.isArray(value.history) ||
    !Array.isArray(value.snapshots) ||
    value.history.length > MAX_GAME_HISTORY ||
    value.snapshots.length > MAX_GAME_SNAPSHOTS
  ) {
    return null;
  }
  const history = value.history.map(normalizeGameState);
  if (
    history.some(
      (state) => state === null || state.boardSize !== currentGame.boardSize,
    )
  ) {
    return null;
  }
  const defaults = createDefaultStore();
  if (!isRecord(value.bestScores)) {
    return null;
  }
  const bestScores = value.bestScores;
  const validScores = [3, 4, 5, 6].every((size) =>
    isNonNegativeInteger(bestScores[String(size)]),
  );
  const gameSettings =
    value.settings === undefined ? defaults.settings : value.settings;
  const perSizeGameValues =
    value.perSizeGames === undefined ? {} : value.perSizeGames;
  const autoSaveMaxTile =
    value.autoSaveMaxTile === undefined
      ? defaults.autoSaveMaxTile
      : value.autoSaveMaxTile;
  if (
    !validScores ||
    !isRecord(autoSaveMaxTile) ||
    ![3, 4, 5, 6].every((size) =>
      isNonNegativeInteger(autoSaveMaxTile[String(size)]),
    ) ||
    !isRecord(gameSettings) ||
    typeof gameSettings.luckyMode !== "boolean" ||
    nullableNumber(value.unlockedAt) === undefined ||
    (value.activeSnapshotId !== undefined &&
      nullableString(value.activeSnapshotId) === undefined) ||
    !isRecord(perSizeGameValues)
  ) {
    return null;
  }
  const snapshots = value.snapshots.map((snapshot) => {
    if (!isRecord(snapshot)) return null;
    const state = normalizeGameState(snapshot.state);
    if (
      !state ||
      typeof snapshot.id !== "string" ||
      typeof snapshot.name !== "string" ||
      !isFiniteNumber(snapshot.timestamp) ||
      nullableString(snapshot.parentSnapshotId) === undefined
    ) {
      return null;
    }
    return {
      id: snapshot.id,
      name: snapshot.name,
      state,
      timestamp: snapshot.timestamp,
      parentSnapshotId: nullableString(snapshot.parentSnapshotId) ?? null,
    };
  });
  if (snapshots.some((snapshot) => snapshot === null)) return null;
  const normalizedSnapshots = snapshots as NonNullable<
    (typeof snapshots)[number]
  >[];
  const snapshotIds = new Set(
    normalizedSnapshots.map((snapshot) => snapshot.id),
  );
  const snapshotParents = new Map(
    normalizedSnapshots.map((snapshot) => [
      snapshot.id,
      snapshot.parentSnapshotId,
    ]),
  );
  const hasParentCycle = normalizedSnapshots.some((snapshot) => {
    const visited = new Set<string>();
    let currentId: string | null = snapshot.id;
    while (currentId != null) {
      if (visited.has(currentId)) return true;
      visited.add(currentId);
      currentId = snapshotParents.get(currentId) ?? null;
    }
    return false;
  });
  if (
    snapshotIds.size !== normalizedSnapshots.length ||
    hasParentCycle ||
    (value.activeSnapshotId != null &&
      !snapshotIds.has(value.activeSnapshotId as string)) ||
    normalizedSnapshots.some(
      (snapshot) =>
        snapshot.parentSnapshotId != null &&
        !snapshotIds.has(snapshot.parentSnapshotId),
    )
  ) {
    return null;
  }
  const perSizeGames: Game2048Store["perSizeGames"] = {};
  for (const size of [3, 4, 5, 6] as const) {
    const entry = perSizeGameValues[size];
    if (entry === undefined) continue;
    if (
      !isRecord(entry) ||
      !Array.isArray(entry.history) ||
      entry.history.length > MAX_GAME_HISTORY
    ) {
      return null;
    }
    const game = normalizeGameState(entry.game);
    const entryHistory = entry.history.map(normalizeGameState);
    if (
      !game ||
      game.boardSize !== size ||
      entryHistory.some((state) => state === null || state.boardSize !== size)
    ) {
      return null;
    }
    perSizeGames[size] = { game, history: entryHistory as GameState[] };
  }
  return {
    ...defaults,
    currentGame,
    history: history as GameState[],
    snapshots: snapshots as Game2048Store["snapshots"],
    bestScores: {
      3: bestScores["3"] as number,
      4: bestScores["4"] as number,
      5: bestScores["5"] as number,
      6: bestScores["6"] as number,
    },
    unlockedAt: nullableNumber(value.unlockedAt) ?? null,
    perSizeGames,
    settings: { luckyMode: gameSettings.luckyMode },
    activeSnapshotId: nullableString(value.activeSnapshotId) ?? null,
    autoSaveMaxTile: {
      3: autoSaveMaxTile["3"] as number,
      4: autoSaveMaxTile["4"] as number,
      5: autoSaveMaxTile["5"] as number,
      6: autoSaveMaxTile["6"] as number,
    },
  };
}

function hasDuplicateIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size !== items.length;
}

export type BackupParseError =
  | "too_large"
  | "too_many_alarms"
  | "too_many_sleep_sessions"
  | "invalid";

export type BackupParseResult =
  | { ok: true; data: BackupData }
  | { ok: false; error: BackupParseError };

export function parseBackupDataResult(raw: string): BackupParseResult {
  if (raw.length > MAX_BACKUP_BYTES) return { ok: false, error: "too_large" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isFiniteNumber(value.timestamp)
  ) {
    return { ok: false, error: "invalid" };
  }
  const settings = normalizeSettings(value.settings);
  if (
    !settings ||
    !Array.isArray(value.alarms) ||
    !Array.isArray(value.sleepSessions)
  ) {
    return { ok: false, error: "invalid" };
  }
  if (value.alarms.length > MAX_ALARMS) {
    return { ok: false, error: "too_many_alarms" };
  }
  if (value.sleepSessions.length > MAX_SLEEP_SESSIONS) {
    return { ok: false, error: "too_many_sleep_sessions" };
  }
  const alarms = value.alarms.map(normalizeAlarm);
  const sleepSessions = value.sleepSessions.map(normalizeSleepSession);
  const game2048 = normalizeGameStore(value.game2048);
  if (
    alarms.some((alarm) => alarm === null) ||
    sleepSessions.some((session) => session === null) ||
    hasDuplicateIds(alarms as Alarm[]) ||
    hasDuplicateIds(sleepSessions as SleepSession[]) ||
    !game2048
  ) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    data: {
      version: 1,
      timestamp: value.timestamp,
      settings,
      alarms: alarms as Alarm[],
      sleepSessions: sleepSessions as SleepSession[],
      game2048,
    },
  };
}

export function parseBackupData(raw: string): BackupData | null {
  const result = parseBackupDataResult(raw);
  return result.ok ? result.data : null;
}

export type BackupCreateError =
  | "too_large"
  | "too_many_alarms"
  | "too_many_sleep_sessions";

export interface BackupPayloadInput {
  timestamp: number;
  settings: AppSettings;
  alarms: Alarm[];
  sleepSessions: SleepSession[];
  game2048: Game2048Store;
}

export type BackupCreateResult =
  | { ok: true; raw: string }
  | { ok: false; error: BackupCreateError };

export function createBackupData(
  input: BackupPayloadInput,
): BackupCreateResult {
  if (input.alarms.length > MAX_ALARMS) {
    return { ok: false, error: "too_many_alarms" };
  }
  if (input.sleepSessions.length > MAX_SLEEP_SESSIONS) {
    return { ok: false, error: "too_many_sleep_sessions" };
  }
  const raw = JSON.stringify({ version: 1, ...input });
  if (raw.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, raw };
}
