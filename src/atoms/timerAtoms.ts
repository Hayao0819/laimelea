import { STORAGE_KEYS } from "../core/storage/keys";
import { createPersistedAtom } from "../core/storage/persistedAtom";
import {
  DEFAULT_STOPWATCH,
  normalizeStopwatch,
  normalizeTimers,
} from "../core/storage/timerState";
import type { StopwatchState, TimerState } from "../models/Timer";

const timerPersistence = createPersistedAtom<TimerState[]>(
  STORAGE_KEYS.TIMER_STATE,
  [],
  normalizeTimers,
);
const stopwatchPersistence = createPersistedAtom<StopwatchState>(
  STORAGE_KEYS.STOPWATCH_STATE,
  DEFAULT_STOPWATCH,
  normalizeStopwatch,
);

export const timersAtom = timerPersistence.valueAtom;
export const stopwatchAtom = stopwatchPersistence.valueAtom;
export const timersHydratedAtom = timerPersistence.hydratedAtom;
export const stopwatchHydratedAtom = stopwatchPersistence.hydratedAtom;
