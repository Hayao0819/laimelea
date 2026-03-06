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
// Write handlers resolve the current value via the sync (unwrapped) atom
// before calling function updaters, because atomWithStorage's baseAtom
// may hold a Promise before async storage resolves.
export const timersAtom = atom(
  (get) => get(syncTimersAtom) ?? [],
  (
    get,
    set,
    update: TimerState[] | ((prev: TimerState[]) => TimerState[]),
  ) => {
    if (typeof update === "function") {
      const current = get(syncTimersAtom) ?? [];
      set(timersStorageAtom, update(current));
    } else {
      set(timersStorageAtom, update);
    }
  },
);

export const stopwatchAtom = atom(
  (get) => get(syncStopwatchAtom) ?? DEFAULT_STOPWATCH,
  (
    get,
    set,
    update: StopwatchState | ((prev: StopwatchState) => StopwatchState),
  ) => {
    if (typeof update === "function") {
      const current = get(syncStopwatchAtom) ?? DEFAULT_STOPWATCH;
      set(stopwatchStorageAtom, update(current));
    } else {
      set(stopwatchStorageAtom, update);
    }
  },
);
