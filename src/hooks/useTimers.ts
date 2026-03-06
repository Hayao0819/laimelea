import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { timersAtom } from "../atoms/timerAtoms";
import {
  cancelTimerTrigger,
  scheduleTimerTrigger,
  showTimerCompleteNotification,
} from "../features/timer/services/timerNotification";
import type { TimerState } from "../models/Timer";

const TICK_INTERVAL = 100;

let nextTimerNumber = 1;

export interface UseTimersReturn {
  timers: TimerState[];
  addTimer: (durationMs: number, label?: string) => void;
  deleteTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  resetTimer: (id: string) => void;
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
          cancelTimerTrigger(t.id);
          showTimerCompleteNotification(t.label);
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

  // Sync display on AppState active resume
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        tick();
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [tick]);

  const addTimer = useCallback(
    (durationMs: number, label?: string) => {
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
      setTimers((prev) => [...prev, timer]);
      scheduleTimerTrigger({
        id: timer.id,
        label: timer.label,
        durationMs: timer.durationMs,
        startedAt: now,
        pausedElapsedMs: 0,
      });
    },
    [setTimers],
  );

  const deleteTimer = useCallback(
    (id: string) => {
      setTimers((prev) => prev.filter((t) => t.id !== id));
      cancelTimerTrigger(id);
    },
    [setTimers],
  );

  const pauseTimer = useCallback(
    (id: string) => {
      setTimers((prev) =>
        prev.map((t) => {
          if (t.id !== id || !t.isRunning || t.startedAt === null) return t;
          return {
            ...t,
            isRunning: false,
            pausedElapsedMs: t.pausedElapsedMs + (Date.now() - t.startedAt),
            startedAt: null,
          };
        }),
      );
      cancelTimerTrigger(id);
    },
    [setTimers],
  );

  const resumeTimer = useCallback(
    (id: string) => {
      const now = Date.now();
      let resumed: TimerState | null = null;
      setTimers((prev) =>
        prev.map((t) => {
          if (t.id !== id || t.isRunning || t.remainingMs <= 0) return t;
          resumed = { ...t, isRunning: true, startedAt: now };
          return resumed;
        }),
      );
      if (resumed) {
        const r = resumed as TimerState;
        scheduleTimerTrigger({
          id: r.id,
          label: r.label,
          durationMs: r.durationMs,
          startedAt: now,
          pausedElapsedMs: r.pausedElapsedMs,
        });
      }
    },
    [setTimers],
  );

  const resetTimer = useCallback(
    (id: string) => {
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
      cancelTimerTrigger(id);
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
