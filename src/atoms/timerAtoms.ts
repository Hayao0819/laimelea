import { atom } from "jotai";
import { atomWithStorage, unwrap } from "jotai/utils";

import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { StopwatchState, TimerState } from "../models/Timer";

const DEFAULT_STOPWATCH: StopwatchState = {
  elapsedMs: 0,
  isRunning: false,
  startedAt: null,
  laps: [],
};

// Base storage atoms — persisted to AsyncStorage
const timersStorageAtom = atomWithStorage<TimerState[]>(
  STORAGE_KEYS.TIMER_STATE,
  [],
  createAsyncStorage<TimerState[]>(),
  { getOnInit: true },
);

const stopwatchStorageAtom = atomWithStorage<StopwatchState>(
  STORAGE_KEYS.STOPWATCH_STATE,
  DEFAULT_STOPWATCH,
  createAsyncStorage<StopwatchState>(),
  { getOnInit: true },
);

// Unwrapped sync read atoms — resolve Promise to sync value with fallback
const syncTimersAtom = unwrap(timersStorageAtom, (prev) => prev ?? []);
const syncStopwatchAtom = unwrap(
  stopwatchStorageAtom,
  (prev) => prev ?? DEFAULT_STOPWATCH,
);

// Public read/write atoms — sync read, persisted write
export const timersAtom = atom(
  (get) => get(syncTimersAtom) ?? [],
  (
    _get,
    set,
    update: TimerState[] | ((prev: TimerState[]) => TimerState[]),
  ) => {
    if (typeof update === "function") {
      set(timersStorageAtom, update as never);
    } else {
      set(timersStorageAtom, update);
    }
  },
);

export const stopwatchAtom = atom(
  (get) => get(syncStopwatchAtom) ?? DEFAULT_STOPWATCH,
  (
    _get,
    set,
    update: StopwatchState | ((prev: StopwatchState) => StopwatchState),
  ) => {
    if (typeof update === "function") {
      set(stopwatchStorageAtom, update as never);
    } else {
      set(stopwatchStorageAtom, update);
    }
  },
);
