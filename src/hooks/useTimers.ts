import { useCallback, useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { timersAtom } from "../atoms/timerAtoms";
import { showTimerCompleteNotification } from "../features/timer/services/timerNotification";
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
        const elapsed = now - t.startedAt + t.pausedElapsed;
        const remaining = Math.max(0, t.durationMs - elapsed);
        changed = true;
        if (remaining <= 0) {
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

  const addTimer = useCallback(
    (durationMs: number, label?: string) => {
      const num = nextTimerNumber++;
      const timer: TimerState = {
        id: generateId(),
        label: label ?? `Timer ${num}`,
        durationMs,
        remainingMs: durationMs,
        isRunning: true,
        startedAt: Date.now(),
        pausedElapsed: 0,
      };
      setTimers((prev) => [...prev, timer]);
    },
    [setTimers],
  );

  const deleteTimer = useCallback(
    (id: string) => {
      setTimers((prev) => prev.filter((t) => t.id !== id));
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
            pausedElapsed: t.pausedElapsed + (Date.now() - t.startedAt),
            startedAt: null,
          };
        }),
      );
    },
    [setTimers],
  );

  const resumeTimer = useCallback(
    (id: string) => {
      setTimers((prev) =>
        prev.map((t) => {
          if (t.id !== id || t.isRunning || t.remainingMs <= 0) return t;
          return {
            ...t,
            isRunning: true,
            startedAt: Date.now(),
          };
        }),
      );
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
            pausedElapsed: 0,
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
