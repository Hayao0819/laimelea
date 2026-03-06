import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { stopwatchAtom } from "../atoms/timerAtoms";

const TICK_INTERVAL = 50;

export interface UseStopwatchReturn {
  elapsedMs: number;
  isRunning: boolean;
  laps: number[];
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  lap: () => void;
}

export function useStopwatch(): UseStopwatchReturn {
  const [stopwatch, setStopwatch] = useAtom(stopwatchAtom);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const previousElapsedRef = useRef<number>(0);
  const restoredRef = useRef(false);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const elapsed =
      Date.now() - startedAtRef.current + previousElapsedRef.current;
    setStopwatch((prev) => ({ ...prev, elapsedMs: elapsed }));
  }, [setStopwatch]);

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(tick, TICK_INTERVAL);
  }, [clearTick, tick]);

  // Restore refs from persisted atom state on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (stopwatch.isRunning && stopwatch.startedAt !== null) {
      // Derive startedAtRef so that elapsed computes correctly from now:
      // elapsed = Date.now() - startedAtRef + 0 should equal real elapsed
      // Real elapsed = Date.now() - original_startedAt + accumulated_before
      // Since atom.startedAt is the original, and accumulated pauses are
      // implicitly encoded in elapsedMs, we use:
      // startedAtRef = Date.now() - elapsedMs (so the first tick is correct)
      startedAtRef.current = Date.now() - stopwatch.elapsedMs;
      previousElapsedRef.current = 0;
      startTick();
    } else if (!stopwatch.isRunning && stopwatch.elapsedMs > 0) {
      previousElapsedRef.current = stopwatch.elapsedMs;
    } else if (stopwatch.isRunning && stopwatch.startedAt === null) {
      // Abnormal state: running but no startedAt — reset
      setStopwatch({
        elapsedMs: 0,
        isRunning: false,
        startedAt: null,
        laps: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync on AppState foreground resume
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && startedAtRef.current > 0) {
        tick();
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [tick]);

  const start = useCallback(() => {
    const now = Date.now();
    startedAtRef.current = now;
    previousElapsedRef.current = 0;
    setStopwatch({
      elapsedMs: 0,
      isRunning: true,
      startedAt: now,
      laps: [],
    });
    startTick();
  }, [setStopwatch, startTick]);

  const pause = useCallback(() => {
    if (!stopwatch.isRunning) return;
    previousElapsedRef.current += Date.now() - startedAtRef.current;
    clearTick();
    setStopwatch((prev) => ({
      ...prev,
      isRunning: false,
      startedAt: null,
    }));
  }, [stopwatch.isRunning, clearTick, setStopwatch]);

  const resume = useCallback(() => {
    if (stopwatch.isRunning) return;
    const now = Date.now();
    startedAtRef.current = now;
    setStopwatch((prev) => ({ ...prev, isRunning: true, startedAt: now }));
    startTick();
  }, [stopwatch.isRunning, setStopwatch, startTick]);

  const reset = useCallback(() => {
    clearTick();
    startedAtRef.current = 0;
    previousElapsedRef.current = 0;
    setStopwatch({
      elapsedMs: 0,
      isRunning: false,
      startedAt: null,
      laps: [],
    });
  }, [clearTick, setStopwatch]);

  const lap = useCallback(() => {
    if (!stopwatch.isRunning) return;
    setStopwatch((prev) => ({
      ...prev,
      laps: [...prev.laps, prev.elapsedMs],
    }));
  }, [stopwatch.isRunning, setStopwatch]);

  useEffect(() => {
    return clearTick;
  }, [clearTick]);

  return {
    elapsedMs: stopwatch.elapsedMs,
    isRunning: stopwatch.isRunning,
    laps: stopwatch.laps,
    start,
    pause,
    resume,
    reset,
    lap,
  };
}
