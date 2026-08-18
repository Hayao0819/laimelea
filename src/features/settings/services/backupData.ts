import type { Alarm, AlarmRepeat } from "../../../models/Alarm";
import {
  type AppSettings,
  DEFAULT_ALARM_DEFAULTS,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../models/Settings";
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

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
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

function normalizeSettings(value: unknown): AppSettings | null {
  if (!isRecord(value)) return null;

  const cycleConfig = value.cycleConfig === undefined ? {} : value.cycleConfig;
  const alarmDefaults =
    value.alarmDefaults === undefined ? {} : value.alarmDefaults;
  const widgetSettings =
    value.widgetSettings === undefined ? {} : value.widgetSettings;
  if (
    !isRecord(cycleConfig) ||
    !isRecord(alarmDefaults) ||
    !isRecord(widgetSettings)
  ) {
    return null;
  }
  if (
    (cycleConfig.cycleLengthMinutes !== undefined &&
      (!isFiniteNumber(cycleConfig.cycleLengthMinutes) ||
        cycleConfig.cycleLengthMinutes <= 0)) ||
    (cycleConfig.baseTimeMs !== undefined &&
      !isFiniteNumber(cycleConfig.baseTimeMs)) ||
    (value.setupComplete !== undefined &&
      typeof value.setupComplete !== "boolean") ||
    (value.primaryTimeDisplay !== undefined &&
      !isOneOf(value.primaryTimeDisplay, ["custom", "24h"] as const)) ||
    (value.language !== undefined && typeof value.language !== "string") ||
    (value.theme !== undefined &&
      !isOneOf(value.theme, ["light", "dark", "system"] as const)) ||
    (value.timeFormat !== undefined &&
      !isOneOf(value.timeFormat, ["12h", "24h"] as const)) ||
    (value.detectedPlatform !== undefined &&
      !isOneOf(value.detectedPlatform, ["aosp", "gms", "hms"] as const)) ||
    (value.timezone !== undefined && typeof value.timezone !== "string") ||
    (value.dstHandling !== undefined &&
      !isOneOf(value.dstHandling, ["auto", "ignore"] as const)) ||
    (value.secondaryTimezone !== undefined &&
      nullableString(value.secondaryTimezone) === undefined) ||
    (value.calendarFirstDayOfWeek !== undefined &&
      !isOneOf(value.calendarFirstDayOfWeek, [0, 1, 6] as const)) ||
    (value.defaultEventReminderMin !== undefined &&
      !isNonNegativeInteger(value.defaultEventReminderMin)) ||
    (value.visibleCalendarIds !== undefined &&
      (!Array.isArray(value.visibleCalendarIds) ||
        !value.visibleCalendarIds.every((id) => typeof id === "string"))) ||
    (value.lastBackupTimestamp !== undefined &&
      nullableNumber(value.lastBackupTimestamp) === undefined) ||
    (alarmDefaults.dismissalMethod !== undefined &&
      !isOneOf(alarmDefaults.dismissalMethod, [
        "simple",
        "shake",
        "math",
      ] as const)) ||
    (alarmDefaults.gradualVolumeDurationSec !== undefined &&
      !isNonNegativeInteger(alarmDefaults.gradualVolumeDurationSec)) ||
    (alarmDefaults.snoozeDurationMin !== undefined &&
      !isPositiveInteger(alarmDefaults.snoozeDurationMin)) ||
    (alarmDefaults.snoozeMaxCount !== undefined &&
      !isNonNegativeInteger(alarmDefaults.snoozeMaxCount)) ||
    (alarmDefaults.vibrationEnabled !== undefined &&
      typeof alarmDefaults.vibrationEnabled !== "boolean") ||
    (alarmDefaults.volumeButtonBehavior !== undefined &&
      !isOneOf(alarmDefaults.volumeButtonBehavior, [
        "snooze",
        "dismiss",
        "volume",
      ] as const)) ||
    (alarmDefaults.mathDifficulty !== undefined &&
      !isOneOf(alarmDefaults.mathDifficulty, [1, 2, 3] as const)) ||
    (widgetSettings.backgroundColor !== undefined &&
      typeof widgetSettings.backgroundColor !== "string") ||
    (widgetSettings.textColor !== undefined &&
      typeof widgetSettings.textColor !== "string") ||
    (widgetSettings.secondaryTextColor !== undefined &&
      typeof widgetSettings.secondaryTextColor !== "string") ||
    (widgetSettings.accentColor !== undefined &&
      typeof widgetSettings.accentColor !== "string") ||
    (widgetSettings.opacity !== undefined &&
      (!isFiniteNumber(widgetSettings.opacity) ||
        widgetSettings.opacity < 0 ||
        widgetSettings.opacity > 100)) ||
    (widgetSettings.borderRadius !== undefined &&
      (!isFiniteNumber(widgetSettings.borderRadius) ||
        widgetSettings.borderRadius < 0)) ||
    (widgetSettings.showRealTime !== undefined &&
      typeof widgetSettings.showRealTime !== "boolean") ||
    (widgetSettings.showNextAlarm !== undefined &&
      typeof widgetSettings.showNextAlarm !== "boolean")
  ) {
    return null;
  }

  return {
    cycleConfig: {
      cycleLengthMinutes:
        cycleConfig.cycleLengthMinutes ??
        DEFAULT_SETTINGS.cycleConfig.cycleLengthMinutes,
      baseTimeMs:
        cycleConfig.baseTimeMs ?? DEFAULT_SETTINGS.cycleConfig.baseTimeMs,
    },
    setupComplete: value.setupComplete ?? DEFAULT_SETTINGS.setupComplete,
    primaryTimeDisplay:
      value.primaryTimeDisplay ?? DEFAULT_SETTINGS.primaryTimeDisplay,
    language: value.language ?? DEFAULT_SETTINGS.language,
    theme: value.theme ?? DEFAULT_SETTINGS.theme,
    timeFormat: value.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
    detectedPlatform:
      value.detectedPlatform ?? DEFAULT_SETTINGS.detectedPlatform,
    timezone: value.timezone ?? DEFAULT_SETTINGS.timezone,
    dstHandling: value.dstHandling ?? DEFAULT_SETTINGS.dstHandling,
    secondaryTimezone:
      value.secondaryTimezone === undefined
        ? DEFAULT_SETTINGS.secondaryTimezone
        : (nullableString(value.secondaryTimezone) ?? null),
    alarmDefaults: {
      ...DEFAULT_ALARM_DEFAULTS,
      dismissalMethod:
        alarmDefaults.dismissalMethod ?? DEFAULT_ALARM_DEFAULTS.dismissalMethod,
      gradualVolumeDurationSec:
        alarmDefaults.gradualVolumeDurationSec ??
        DEFAULT_ALARM_DEFAULTS.gradualVolumeDurationSec,
      snoozeDurationMin:
        alarmDefaults.snoozeDurationMin ??
        DEFAULT_ALARM_DEFAULTS.snoozeDurationMin,
      snoozeMaxCount:
        alarmDefaults.snoozeMaxCount ?? DEFAULT_ALARM_DEFAULTS.snoozeMaxCount,
      vibrationEnabled:
        alarmDefaults.vibrationEnabled ??
        DEFAULT_ALARM_DEFAULTS.vibrationEnabled,
      volumeButtonBehavior:
        alarmDefaults.volumeButtonBehavior ??
        DEFAULT_ALARM_DEFAULTS.volumeButtonBehavior,
      mathDifficulty:
        alarmDefaults.mathDifficulty ?? DEFAULT_ALARM_DEFAULTS.mathDifficulty,
    },
    calendarFirstDayOfWeek:
      value.calendarFirstDayOfWeek ?? DEFAULT_SETTINGS.calendarFirstDayOfWeek,
    defaultEventReminderMin:
      value.defaultEventReminderMin ?? DEFAULT_SETTINGS.defaultEventReminderMin,
    visibleCalendarIds:
      value.visibleCalendarIds === undefined
        ? DEFAULT_SETTINGS.visibleCalendarIds
        : [...value.visibleCalendarIds],
    lastBackupTimestamp:
      value.lastBackupTimestamp === undefined
        ? DEFAULT_SETTINGS.lastBackupTimestamp
        : (nullableNumber(value.lastBackupTimestamp) ?? null),
    widgetSettings: {
      backgroundColor:
        widgetSettings.backgroundColor ??
        DEFAULT_WIDGET_SETTINGS.backgroundColor,
      textColor: widgetSettings.textColor ?? DEFAULT_WIDGET_SETTINGS.textColor,
      secondaryTextColor:
        widgetSettings.secondaryTextColor ??
        DEFAULT_WIDGET_SETTINGS.secondaryTextColor,
      accentColor:
        widgetSettings.accentColor ?? DEFAULT_WIDGET_SETTINGS.accentColor,
      opacity: widgetSettings.opacity ?? DEFAULT_WIDGET_SETTINGS.opacity,
      borderRadius:
        widgetSettings.borderRadius ?? DEFAULT_WIDGET_SETTINGS.borderRadius,
      showRealTime:
        widgetSettings.showRealTime ?? DEFAULT_WIDGET_SETTINGS.showRealTime,
      showNextAlarm:
        widgetSettings.showNextAlarm ?? DEFAULT_WIDGET_SETTINGS.showNextAlarm,
    },
  };
}

function normalizeRepeat(value: unknown): AlarmRepeat | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (
    value.type === "interval" &&
    isFiniteNumber(value.intervalMs) &&
    value.intervalMs > 0
  ) {
    return { type: "interval", intervalMs: value.intervalMs };
  }
  if (
    value.type === "weekdays" &&
    Array.isArray(value.weekdays) &&
    value.weekdays.every((day) => isInteger(day) && day >= 0 && day <= 6)
  ) {
    return { type: "weekdays", weekdays: [...value.weekdays] };
  }
  if (
    value.type === "customCycleInterval" &&
    isFiniteNumber(value.customCycleIntervalDays) &&
    value.customCycleIntervalDays > 0
  ) {
    return {
      type: "customCycleInterval",
      customCycleIntervalDays: value.customCycleIntervalDays,
    };
  }
  return undefined;
}

function normalizeAlarm(value: unknown): Alarm | null {
  if (!isRecord(value)) return null;
  const repeat = normalizeRepeat(value.repeat);
  const linkedEventOffsetMs =
    value.linkedEventOffsetMs === undefined
      ? (value.linkedEventOffset ?? 0)
      : value.linkedEventOffsetMs;
  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.enabled !== "boolean" ||
    !isFiniteNumber(value.targetTimestampMs) ||
    (value.recurrenceAnchorTimestampMs !== undefined &&
      nullableNumber(value.recurrenceAnchorTimestampMs) === undefined) ||
    !isOneOf(value.setInTimeSystem, ["custom", "24h"] as const) ||
    repeat === undefined ||
    !isOneOf(value.dismissalMethod, ["simple", "shake", "math"] as const) ||
    !isNonNegativeInteger(value.gradualVolumeDurationSec) ||
    !isPositiveInteger(value.snoozeDurationMin) ||
    !isNonNegativeInteger(value.snoozeMaxCount) ||
    !isNonNegativeInteger(value.snoozeCount) ||
    value.snoozeCount > value.snoozeMaxCount ||
    !isNonNegativeInteger(value.autoSilenceMin) ||
    nullableString(value.soundUri) === undefined ||
    typeof value.vibrationEnabled !== "boolean" ||
    nullableString(value.notifeeTriggerId) === undefined ||
    typeof value.skipNextOccurrence !== "boolean" ||
    nullableString(value.linkedCalendarEventId) === undefined ||
    (value.linkedCalendarSourceEventId !== undefined &&
      nullableString(value.linkedCalendarSourceEventId) === undefined) ||
    !isFiniteNumber(linkedEventOffsetMs) ||
    (value.mathDifficulty !== undefined &&
      !isOneOf(value.mathDifficulty, [1, 2, 3] as const)) ||
    (value.isTest !== undefined && typeof value.isTest !== "boolean") ||
    nullableNumber(value.lastFiredAt) === undefined ||
    (value.activeOccurrenceTimestampMs !== undefined &&
      nullableNumber(value.activeOccurrenceTimestampMs) === undefined) ||
    (value.lastDeliveredOccurrenceTimestampMs !== undefined &&
      nullableNumber(value.lastDeliveredOccurrenceTimestampMs) === undefined) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    enabled: value.enabled,
    targetTimestampMs: value.targetTimestampMs,
    recurrenceAnchorTimestampMs:
      nullableNumber(value.recurrenceAnchorTimestampMs) ?? null,
    setInTimeSystem: value.setInTimeSystem,
    repeat,
    dismissalMethod: value.dismissalMethod,
    gradualVolumeDurationSec: value.gradualVolumeDurationSec,
    snoozeDurationMin: value.snoozeDurationMin,
    snoozeMaxCount: value.snoozeMaxCount,
    snoozeCount: value.snoozeCount,
    autoSilenceMin: value.autoSilenceMin,
    soundUri: nullableString(value.soundUri) ?? null,
    vibrationEnabled: value.vibrationEnabled,
    notifeeTriggerId: nullableString(value.notifeeTriggerId) ?? null,
    skipNextOccurrence: value.skipNextOccurrence,
    linkedCalendarEventId: nullableString(value.linkedCalendarEventId) ?? null,
    linkedCalendarSourceEventId:
      nullableString(value.linkedCalendarSourceEventId) ?? null,
    linkedEventOffsetMs,
    mathDifficulty:
      value.mathDifficulty ?? DEFAULT_ALARM_DEFAULTS.mathDifficulty,
    isTest: value.isTest,
    lastFiredAt: nullableNumber(value.lastFiredAt) ?? null,
    activeOccurrenceTimestampMs:
      nullableNumber(value.activeOccurrenceTimestampMs) ?? null,
    lastDeliveredOccurrenceTimestampMs:
      nullableNumber(value.lastDeliveredOccurrenceTimestampMs) ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
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

export function parseBackupData(raw: string): BackupData | null {
  if (raw.length > MAX_BACKUP_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isFiniteNumber(value.timestamp)
  ) {
    return null;
  }
  const settings = normalizeSettings(value.settings);
  if (
    !settings ||
    !Array.isArray(value.alarms) ||
    !Array.isArray(value.sleepSessions) ||
    value.alarms.length > MAX_ALARMS ||
    value.sleepSessions.length > MAX_SLEEP_SESSIONS
  ) {
    return null;
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
    return null;
  }
  return {
    version: 1,
    timestamp: value.timestamp,
    settings,
    alarms: alarms as Alarm[],
    sleepSessions: sleepSessions as SleepSession[],
    game2048,
  };
}
