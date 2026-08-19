import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { timersAtom, timersHydratedAtom } from "../atoms/timerAtoms";
import {
  cancelTimerTrigger,
  consumeCompletedTimerIds,
  readNativeScheduledTimerIds,
  readNativeTimerRemainingMs,
  scheduleTimerTrigger,
} from "../features/timer/services/timerNotification";
import { completeTimers } from "../features/timer/services/timerState";
import type { TimerState } from "../models/Timer";

const TICK_INTERVAL = 100;

let nextTimerNumber = 1;
let timerMutationQueue: Promise<void> = Promise.resolve();

function enqueueTimerMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = timerMutationQueue.then(operation, operation);
  timerMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export interface UseTimersReturn {
  timers: TimerState[];
  isHydrated?: boolean;
  addTimer: (durationMs: number, label?: string) => Promise<void>;
  deleteTimer: (id: string) => Promise<void>;
  pauseTimer: (id: string) => Promise<void>;
  resumeTimer: (id: string) => Promise<void>;
  resetTimer: (id: string) => Promise<void>;
}

export class TimerStateLoadingError extends Error {
  constructor() {
    super("Timers are still loading.");
    this.name = "TimerStateLoadingError";
  }
}

export class InvalidTimerDurationError extends Error {
  constructor() {
    super("Timer duration must be a positive safe integer.");
    this.name = "InvalidTimerDurationError";
  }
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useTimers(): UseTimersReturn {
  const [timers, setTimers] = useAtom(timersAtom);
  const isHydrated = useAtomValue(timersHydratedAtom);
  const [displayTimers, setDisplayTimers] = useState(timers);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef(timers);
  const runtimeStartedAtRef = useRef(new Map<string, number>());

  const persistTimers = useCallback(
    (nextTimers: TimerState[]): Promise<void> => {
      timersRef.current = nextTimers;
      return Promise.resolve(setTimers(nextTimers));
    },
    [setTimers],
  );

  const restoreTimers = useCallback(
    (previousTimers: TimerState[]): Promise<void> => {
      timersRef.current = previousTimers;
      setDisplayTimers(previousTimers);
      return Promise.resolve(setTimers(previousTimers)).catch(() => undefined);
    },
    [setTimers],
  );

  const elapsedForTimer = useCallback((timer: TimerState): number => {
    if (!timer.isRunning || timer.startedAt === null) {
      return timer.pausedElapsedMs;
    }
    const runtimeStartedAt = runtimeStartedAtRef.current.get(timer.id);
    const elapsedSinceStart =
      runtimeStartedAt === undefined
        ? Math.max(0, Date.now() - timer.startedAt)
        : Math.max(0, monotonicNow() - runtimeStartedAt);
    return timer.pausedElapsedMs + elapsedSinceStart;
  }, []);

  const scheduleRunningTimer = useCallback(
    async (timer: TimerState) => {
      const remainingMs = Math.max(
        0,
        timer.durationMs - elapsedForTimer(timer),
      );
      if (remainingMs <= 0) return;
      await scheduleTimerTrigger({
        id: timer.id,
        label: timer.label,
        durationMs: timer.durationMs,
        startedAt: Date.now(),
        pausedElapsedMs: timer.durationMs - remainingMs,
      });
    },
    [elapsedForTimer],
  );

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reconcileNativeTimers = useCallback(async () => {
    const nativeScheduledTimerIds = await readNativeScheduledTimerIds();
    const runningTimers = timersRef.current.filter(
      (timer) => timer.isRunning && timer.startedAt !== null,
    );

    const remainingById = await Promise.all(
      runningTimers.map(async (timer) => ({
        id: timer.id,
        remainingMs: await readNativeTimerRemainingMs(timer.id),
      })),
    );
    const resolvedRemaining = new Map(
      remainingById.flatMap(({ id, remainingMs }) =>
        remainingMs === null ? [] : [[id, remainingMs] as const],
      ),
    );
    const previousTimers = timersRef.current;
    const now = Date.now();
    const nextTimers = previousTimers.map((timer) => {
      const remainingMs = resolvedRemaining.get(timer.id);
      if (
        remainingMs === undefined ||
        !timer.isRunning ||
        timer.startedAt === null
      ) {
        return timer;
      }
      const boundedRemaining = Math.min(timer.durationMs, remainingMs);
      runtimeStartedAtRef.current.set(timer.id, monotonicNow());
      return {
        ...timer,
        remainingMs: boundedRemaining,
        pausedElapsedMs: timer.durationMs - boundedRemaining,
        startedAt: now,
      };
    });
    if (previousTimers.some((timer, index) => timer !== nextTimers[index])) {
      try {
        await persistTimers(nextTimers);
      } catch {
        await restoreTimers(previousTimers);
        return;
      }
    }

    if (nativeScheduledTimerIds === null) return;
    const runningIds = new Set(
      timersRef.current
        .filter((timer) => timer.isRunning && timer.startedAt !== null)
        .map((timer) => timer.id),
    );
    await Promise.all(
      nativeScheduledTimerIds
        .filter((id) => !runningIds.has(id))
        .map((id) => cancelTimerTrigger(id)),
    );
    const scheduledIds = new Set(nativeScheduledTimerIds);
    for (const timer of timersRef.current) {
      if (
        timer.isRunning &&
        timer.startedAt !== null &&
        !scheduledIds.has(timer.id)
      ) {
        await scheduleRunningTimer(timer);
      }
    }
  }, [persistTimers, restoreTimers, scheduleRunningTimer]);

  const tick = useCallback(() => {
    const completedIds: string[] = [];
    const nextDisplayTimers = timersRef.current.map((timer) => {
      if (!timer.isRunning || timer.startedAt === null) return timer;
      const elapsed = elapsedForTimer(timer);
      const remainingMs = Math.max(0, timer.durationMs - elapsed);
      if (remainingMs <= 0) {
        completedIds.push(timer.id);
        return {
          ...timer,
          remainingMs: 0,
          isRunning: false,
          startedAt: null,
          pausedElapsedMs: timer.durationMs,
        };
      }
      return { ...timer, remainingMs };
    });

    timersRef.current = nextDisplayTimers;
    setDisplayTimers(nextDisplayTimers);

    if (completedIds.length === 0) return;
    for (const id of completedIds) runtimeStartedAtRef.current.delete(id);
    // Persist against a fresh read + id-based merge (not the array snapshot
    // captured above) so a mutation that runs first while this is queued
    // isn't clobbered by a stale completion write.
    enqueueTimerMutation(async () => {
      const previousTimers = timersRef.current;
      const completedTimers = completeTimers(previousTimers, completedIds);
      try {
        await persistTimers(completedTimers);
      } catch {
        timersRef.current = previousTimers;
        setDisplayTimers(previousTimers);
        await persistTimers(previousTimers).catch(() => undefined);
      }
    }).catch(() => undefined);
  }, [elapsedForTimer, persistTimers]);

  const applyCompletedTimers = useCallback(async () => {
    const completedTimerIds = await consumeCompletedTimerIds();
    if (completedTimerIds.length === 0) return;
    const previousTimers = timersRef.current;
    const completedTimers = completeTimers(previousTimers, completedTimerIds);
    try {
      await persistTimers(completedTimers);
    } catch {
      timersRef.current = previousTimers;
      setDisplayTimers(previousTimers);
      await persistTimers(previousTimers).catch(() => undefined);
    }
  }, [persistTimers]);

  const startTick = useCallback(() => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(tick, TICK_INTERVAL);
  }, [tick]);

  useEffect(() => {
    timersRef.current = timers;
    const runtimeNow = monotonicNow();
    for (const timer of timers) {
      if (timer.isRunning && timer.startedAt !== null) {
        if (!runtimeStartedAtRef.current.has(timer.id)) {
          runtimeStartedAtRef.current.set(
            timer.id,
            runtimeNow - Math.max(0, Date.now() - timer.startedAt),
          );
        }
      } else {
        runtimeStartedAtRef.current.delete(timer.id);
      }
    }
    setDisplayTimers(timers);
  }, [timers]);

  useEffect(() => {
    const hasRunning = timers.some((t) => t.isRunning);
    if (hasRunning) {
      startTick();
    } else {
      clearTick();
    }
  }, [timers, startTick, clearTick]);

  useEffect(() => {
    return clearTick;
  }, [clearTick]);

  useEffect(() => {
    if (!isHydrated) return;
    enqueueTimerMutation(async () => {
      await applyCompletedTimers();
      await reconcileNativeTimers();
    }).catch(() => undefined);
  }, [applyCompletedTimers, isHydrated, reconcileNativeTimers]);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        enqueueTimerMutation(async () => {
          await applyCompletedTimers();
          await reconcileNativeTimers();
          tick();
        }).catch(() => undefined);
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [applyCompletedTimers, reconcileNativeTimers, tick]);

  const addTimer = useCallback(
    async (durationMs: number, label?: string) => {
      if (!isHydrated) throw new TimerStateLoadingError();
      if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
        throw new InvalidTimerDurationError();
      }
      const num = nextTimerNumber++;
      const now = Date.now();
      const timer: TimerState = {
        id: generateId(),
        label: label ?? `Timer ${num}`,
        durationMs,
        remainingMs: durationMs,
        isRunning: true,
        startedAt: now,
        pausedElapsedMs: 0,
      };
      const previousTimers = timersRef.current;
      const nextTimers = [...previousTimers, timer];
      try {
        await persistTimers(nextTimers);
      } catch (error) {
        await restoreTimers(previousTimers);
        throw error;
      }
      try {
        await scheduleRunningTimer(timer);
        runtimeStartedAtRef.current.set(timer.id, monotonicNow());
      } catch (error) {
        await cancelTimerTrigger(timer.id).catch(() => undefined);
        await restoreTimers(previousTimers);
        throw error;
      }
    },
    [isHydrated, persistTimers, restoreTimers, scheduleRunningTimer],
  );

  const deleteTimer = useCallback(
    async (id: string) => {
      if (!isHydrated) throw new TimerStateLoadingError();
      const previousTimers = timersRef.current;
      const nextTimers = previousTimers.filter((timer) => timer.id !== id);
      if (nextTimers.length === previousTimers.length) return;
      try {
        await persistTimers(nextTimers);
      } catch (error) {
        await restoreTimers(previousTimers);
        throw error;
      }
      try {
        await cancelTimerTrigger(id);
        runtimeStartedAtRef.current.delete(id);
      } catch (error) {
        await restoreTimers(previousTimers);
        const previousTimer = previousTimers.find((timer) => timer.id === id);
        if (previousTimer?.isRunning) {
          await scheduleRunningTimer(previousTimer).catch(() => undefined);
        }
        throw error;
      }
    },
    [isHydrated, persistTimers, restoreTimers, scheduleRunningTimer],
  );

  const pauseTimer = useCallback(
    async (id: string) => {
      if (!isHydrated) throw new TimerStateLoadingError();
      const previousTimers = timersRef.current;
      const target = previousTimers.find((t) => t.id === id);
      if (!target || !target.isRunning || target.startedAt === null) return;

      const elapsed = elapsedForTimer(target);
      // A timer paused after it already ran out is truthfully a
      // completion, not a pause: give it the same shape completeTimers()
      // produces so the UI doesn't show a half-paused, half-complete state.
      const nextTimers =
        elapsed >= target.durationMs
          ? completeTimers(previousTimers, [id])
          : previousTimers.map((t) =>
              t.id === id
                ? {
                    ...t,
                    isRunning: false,
                    remainingMs: Math.max(0, t.durationMs - elapsed),
                    pausedElapsedMs: elapsed,
                    startedAt: null,
                  }
                : t,
            );
      if (!previousTimers.some((timer, index) => timer !== nextTimers[index])) {
        return;
      }
      try {
        await persistTimers(nextTimers);
      } catch (error) {
        await restoreTimers(previousTimers);
        throw error;
      }
      try {
        await cancelTimerTrigger(id);
        runtimeStartedAtRef.current.delete(id);
      } catch (error) {
        await restoreTimers(previousTimers);
        const previousTimer = previousTimers.find((timer) => timer.id === id);
        if (previousTimer?.isRunning) {
          await scheduleRunningTimer(previousTimer).catch(() => undefined);
        }
        throw error;
      }
    },
    [
      elapsedForTimer,
      isHydrated,
      persistTimers,
      restoreTimers,
      scheduleRunningTimer,
    ],
  );

  const resumeTimer = useCallback(
    async (id: string) => {
      if (!isHydrated) throw new TimerStateLoadingError();
      const now = Date.now();
      const previousTimers = timersRef.current;
      const timer = previousTimers.find(
        (candidate) =>
          candidate.id === id &&
          !candidate.isRunning &&
          candidate.remainingMs > 0,
      );
      if (!timer) return;

      const resumedTimer: TimerState = {
        ...timer,
        isRunning: true,
        startedAt: now,
      };
      const nextTimers = previousTimers.map((candidate) =>
        candidate.id === id && !candidate.isRunning && candidate.remainingMs > 0
          ? resumedTimer
          : candidate,
      );
      try {
        await persistTimers(nextTimers);
      } catch (error) {
        await restoreTimers(previousTimers);
        throw error;
      }
      try {
        await scheduleRunningTimer(resumedTimer);
        runtimeStartedAtRef.current.set(timer.id, monotonicNow());
      } catch (error) {
        await cancelTimerTrigger(timer.id).catch(() => undefined);
        await restoreTimers(previousTimers);
        throw error;
      }
    },
    [isHydrated, persistTimers, restoreTimers, scheduleRunningTimer],
  );

  const resetTimer = useCallback(
    async (id: string) => {
      if (!isHydrated) throw new TimerStateLoadingError();
      const previousTimers = timersRef.current;
      const nextTimers = previousTimers.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          remainingMs: t.durationMs,
          isRunning: false,
          startedAt: null,
          pausedElapsedMs: 0,
        };
      });
      if (!previousTimers.some((timer, index) => timer !== nextTimers[index])) {
        return;
      }
      try {
        await persistTimers(nextTimers);
      } catch (error) {
        await restoreTimers(previousTimers);
        throw error;
      }
      try {
        await cancelTimerTrigger(id);
        runtimeStartedAtRef.current.delete(id);
      } catch (error) {
        await restoreTimers(previousTimers);
        const previousTimer = previousTimers.find((timer) => timer.id === id);
        if (previousTimer?.isRunning) {
          await scheduleRunningTimer(previousTimer).catch(() => undefined);
        }
        throw error;
      }
    },
    [isHydrated, persistTimers, restoreTimers, scheduleRunningTimer],
  );

  const queuedAddTimer = useCallback(
    (durationMs: number, label?: string) =>
      enqueueTimerMutation(() => addTimer(durationMs, label)),
    [addTimer],
  );
  const queuedDeleteTimer = useCallback(
    (id: string) => enqueueTimerMutation(() => deleteTimer(id)),
    [deleteTimer],
  );
  const queuedPauseTimer = useCallback(
    (id: string) => enqueueTimerMutation(() => pauseTimer(id)),
    [pauseTimer],
  );
  const queuedResumeTimer = useCallback(
    (id: string) => enqueueTimerMutation(() => resumeTimer(id)),
    [resumeTimer],
  );
  const queuedResetTimer = useCallback(
    (id: string) => enqueueTimerMutation(() => resetTimer(id)),
    [resetTimer],
  );

  return {
    timers: displayTimers,
    isHydrated,
    addTimer: queuedAddTimer,
    deleteTimer: queuedDeleteTimer,
    pauseTimer: queuedPauseTimer,
    resumeTimer: queuedResumeTimer,
    resetTimer: queuedResetTimer,
  };
}
