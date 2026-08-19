import type { StopwatchState, TimerState } from "../../models/Timer";

export const DEFAULT_STOPWATCH: StopwatchState = {
  elapsedMs: 0,
  isRunning: false,
  startedAt: null,
  laps: [],
};

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function normalizeTimers(value: unknown): TimerState[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((timer): TimerState[] => {
    if (typeof timer !== "object" || timer === null) return [];
    const candidate = timer as Record<string, unknown>;
    const isValid =
      typeof candidate.id === "string" &&
      typeof candidate.label === "string" &&
      isNonNegativeSafeInteger(candidate.durationMs) &&
      candidate.durationMs > 0 &&
      isNonNegativeFinite(candidate.remainingMs) &&
      candidate.remainingMs <= candidate.durationMs &&
      typeof candidate.isRunning === "boolean" &&
      (candidate.startedAt === null || isFiniteNumber(candidate.startedAt)) &&
      (candidate.isRunning ? candidate.startedAt !== null : true) &&
      (!candidate.isRunning ? candidate.startedAt === null : true) &&
      isNonNegativeFinite(candidate.pausedElapsedMs);
    if (!isValid) return [];

    const validTimer = candidate as unknown as TimerState;
    if (validTimer.remainingMs === 0 && !validTimer.isRunning) {
      return [{ ...validTimer, pausedElapsedMs: validTimer.durationMs }];
    }
    // A running timer whose elapsed time already exceeds its duration is
    // corrupted the same way a stale paused one is: repair it into the
    // completed shape instead of silently dropping it.
    if (
      validTimer.isRunning &&
      (validTimer.remainingMs === 0 ||
        validTimer.pausedElapsedMs >= validTimer.durationMs)
    ) {
      return [
        {
          ...validTimer,
          remainingMs: 0,
          isRunning: false,
          startedAt: null,
          pausedElapsedMs: validTimer.durationMs,
        },
      ];
    }
    return validTimer.remainingMs ===
      validTimer.durationMs - validTimer.pausedElapsedMs
      ? [validTimer]
      : [];
  });
}

export function normalizeStopwatch(value: unknown): StopwatchState {
  if (typeof value !== "object" || value === null) return DEFAULT_STOPWATCH;
  const candidate = value as Record<string, unknown>;
  if (
    !isNonNegativeFinite(candidate.elapsedMs) ||
    typeof candidate.isRunning !== "boolean" ||
    (candidate.startedAt !== null && !isFiniteNumber(candidate.startedAt)) ||
    (candidate.isRunning && candidate.startedAt === null) ||
    !Array.isArray(candidate.laps) ||
    !candidate.laps.every(isNonNegativeFinite)
  ) {
    return DEFAULT_STOPWATCH;
  }
  const startedAtElapsedMs = isNonNegativeFinite(candidate.startedAtElapsedMs)
    ? candidate.startedAtElapsedMs
    : undefined;
  const bootCount = isNonNegativeSafeInteger(candidate.bootCount)
    ? candidate.bootCount
    : undefined;
  const hasElapsedClock =
    startedAtElapsedMs !== undefined && bootCount !== undefined;
  return {
    elapsedMs: candidate.elapsedMs,
    isRunning: candidate.isRunning,
    startedAt: candidate.startedAt,
    ...(hasElapsedClock ? { startedAtElapsedMs, bootCount } : {}),
    laps: [...candidate.laps],
  };
}
