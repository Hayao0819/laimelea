import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { timersAtom } from "../atoms/timerAtoms";
import {
  cancelTimerTrigger,
  consumeCompletedTimerIds,
  scheduleTimerTrigger,
} from "../features/timer/services/timerNotification";
import { completeTimers } from "../features/timer/services/timerState";
import type { TimerState } from "../models/Timer";

const TICK_INTERVAL = 100;

let nextTimerNumber = 1;

export interface UseTimersReturn {
  timers: TimerState[];
  addTimer: (durationMs: number, label?: string) => Promise<void>;
  deleteTimer: (id: string) => Promise<void>;
  pauseTimer: (id: string) => Promise<void>;
  resumeTimer: (id: string) => Promise<void>;
  resetTimer: (id: string) => Promise<void>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useTimers(): UseTimersReturn {
  const [timers, setTimers] = useAtom(timersAtom);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setTimers((prev) => {
      const now = Date.now();
      let changed = false;
      const next = prev.map((t) => {
        if (!t.isRunning || t.startedAt === null) return t;
        const elapsed = now - t.startedAt + t.pausedElapsedMs;
        const remaining = Math.max(0, t.durationMs - elapsed);
        changed = true;
        if (remaining <= 0) {
          return { ...t, remainingMs: 0, isRunning: false };
        }
        return { ...t, remainingMs: remaining };
      });
      return changed ? next : prev;
    });
  }, [setTimers]);

  const startTick = useCallback(() => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(tick, TICK_INTERVAL);
  }, [tick]);

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
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        consumeCompletedTimerIds()
          .then((completedTimerIds) => {
            if (completedTimerIds.length === 0) {
              tick();
              return;
            }
            setTimers((previousTimers) =>
              completeTimers(previousTimers, completedTimerIds),
            );
          })
          .catch(() => {});
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [setTimers, tick]);

  const addTimer = useCallback(
    async (durationMs: number, label?: string) => {
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
      await scheduleTimerTrigger({
        id: timer.id,
        label: timer.label,
        durationMs: timer.durationMs,
        startedAt: now,
        pausedElapsedMs: 0,
      });
      setTimers((prev) => [...prev, timer]);
    },
    [setTimers],
  );

  const deleteTimer = useCallback(
    async (id: string) => {
      await cancelTimerTrigger(id);
      setTimers((prev) => prev.filter((t) => t.id !== id));
    },
    [setTimers],
  );

  const pauseTimer = useCallback(
    async (id: string) => {
      const pausedAt = Date.now();
      await cancelTimerTrigger(id);
      setTimers((prev) =>
        prev.map((t) => {
          if (t.id !== id || !t.isRunning || t.startedAt === null) return t;
          const pausedElapsedMs = t.pausedElapsedMs + (pausedAt - t.startedAt);
          return {
            ...t,
            isRunning: false,
            remainingMs: Math.max(0, t.durationMs - pausedElapsedMs),
            pausedElapsedMs,
            startedAt: null,
          };
        }),
      );
    },
    [setTimers],
  );

  const resumeTimer = useCallback(
    async (id: string) => {
      const now = Date.now();
      const timer = timers.find(
        (candidate) =>
          candidate.id === id &&
          !candidate.isRunning &&
          candidate.remainingMs > 0,
      );
      if (!timer) return;

      await scheduleTimerTrigger({
        id: timer.id,
        label: timer.label,
        durationMs: timer.durationMs,
        startedAt: now,
        pausedElapsedMs: timer.pausedElapsedMs,
      });
      setTimers((prev) =>
        prev.map((candidate) =>
          candidate.id === id &&
          !candidate.isRunning &&
          candidate.remainingMs > 0
            ? { ...candidate, isRunning: true, startedAt: now }
            : candidate,
        ),
      );
    },
    [setTimers, timers],
  );

  const resetTimer = useCallback(
    async (id: string) => {
      await cancelTimerTrigger(id);
      setTimers((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            remainingMs: t.durationMs,
            isRunning: false,
            startedAt: null,
            pausedElapsedMs: 0,
          };
        }),
      );
    },
    [setTimers],
  );

  return {
    timers,
    addTimer,
    deleteTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  };
}
