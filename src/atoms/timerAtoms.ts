import { atom } from "jotai";

import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { StopwatchState, TimerState } from "../models/Timer";

const DEFAULT_STOPWATCH: StopwatchState = {
  elapsedMs: 0,
  isRunning: false,
  startedAt: null,
  laps: [],
};

interface PersistedValue<T> {
  value: T;
  hydrated: boolean;
  hasLocalWrite: boolean;
}

function createPersistedAtom<T>(key: string, initialValue: T) {
  const storage = createAsyncStorage<T>();
  const stateAtom = atom<PersistedValue<T>>({
    value: initialValue,
    hydrated: false,
    hasLocalWrite: false,
  });

  stateAtom.onMount = (setState) => {
    let mounted = true;

    Promise.resolve(storage.getItem(key, initialValue))
      .then((storedValue) => {
        if (!mounted) return;
        setState((previous) => ({
          ...previous,
          value: previous.hasLocalWrite ? previous.value : storedValue,
          hydrated: true,
        }));
      })
      .catch(() => {
        if (!mounted) return;
        setState((previous) => ({ ...previous, hydrated: true }));
      });

    return () => {
      mounted = false;
    };
  };

  const valueAtom = atom(
    (get) => get(stateAtom).value,
    (get, set, update: T | ((previous: T) => T)) => {
      const current = get(stateAtom).value;
      const nextValue =
        typeof update === "function"
          ? (update as (previous: T) => T)(current)
          : update;

      set(stateAtom, {
        value: nextValue,
        hydrated: true,
        hasLocalWrite: true,
      });
      return storage.setItem(key, nextValue);
    },
  );

  return {
    valueAtom,
    hydratedAtom: atom((get) => get(stateAtom).hydrated),
  };
}

const timerPersistence = createPersistedAtom<TimerState[]>(
  STORAGE_KEYS.TIMER_STATE,
  [],
);
const stopwatchPersistence = createPersistedAtom<StopwatchState>(
  STORAGE_KEYS.STOPWATCH_STATE,
  DEFAULT_STOPWATCH,
);

export const timersAtom = timerPersistence.valueAtom;
export const stopwatchAtom = stopwatchPersistence.valueAtom;
export const stopwatchHydratedAtom = stopwatchPersistence.hydratedAtom;
