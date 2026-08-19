import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { stopwatchAtom, stopwatchHydratedAtom } from "../atoms/timerAtoms";

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
  const isHydrated = useAtomValue(stopwatchHydratedAtom);
  const [elapsedMs, setElapsedMs] = useState(stopwatch.elapsedMs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedMsRef = useRef(stopwatch.elapsedMs);
  const isRunningRef = useRef(false);
  const hasLocalActionRef = useRef(false);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!isRunningRef.current) return;
    const elapsed = Math.max(0, Date.now() - startedAtRef.current);
    elapsedMsRef.current = elapsed;
    setElapsedMs(elapsed);
  }, []);

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(tick, TICK_INTERVAL);
  }, [clearTick, tick]);

  useEffect(() => {
    if (!isHydrated || hasLocalActionRef.current) return;

    if (stopwatch.isRunning && stopwatch.startedAt !== null) {
      const elapsed = Math.max(
        stopwatch.elapsedMs,
        Date.now() - stopwatch.startedAt,
      );
      startedAtRef.current = Date.now() - elapsed;
      elapsedMsRef.current = elapsed;
      isRunningRef.current = true;
      setElapsedMs(elapsed);
      startTick();
    } else if (!stopwatch.isRunning) {
      clearTick();
      startedAtRef.current = 0;
      elapsedMsRef.current = stopwatch.elapsedMs;
      isRunningRef.current = false;
      setElapsedMs(stopwatch.elapsedMs);
    } else {
      hasLocalActionRef.current = true;
      clearTick();
      startedAtRef.current = 0;
      elapsedMsRef.current = 0;
      isRunningRef.current = false;
      setElapsedMs(0);
      setStopwatch({
        elapsedMs: 0,
        isRunning: false,
        startedAt: null,
        laps: [],
      });
    }
  }, [clearTick, isHydrated, setStopwatch, startTick, stopwatch]);

  // Re-sync on AppState foreground resume
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && isRunningRef.current) {
        tick();
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [tick]);

  const start = useCallback(() => {
    hasLocalActionRef.current = true;
    const now = Date.now();
    startedAtRef.current = now;
    elapsedMsRef.current = 0;
    isRunningRef.current = true;
    setElapsedMs(0);
    setStopwatch({
      elapsedMs: 0,
      isRunning: true,
      startedAt: now,
      laps: [],
    });
    startTick();
  }, [setStopwatch, startTick]);

  const pause = useCallback(() => {
    if (!isRunningRef.current) return;
    hasLocalActionRef.current = true;
    const elapsed = Math.max(0, Date.now() - startedAtRef.current);
    elapsedMsRef.current = elapsed;
    isRunningRef.current = false;
    clearTick();
    setStopwatch((prev) => ({
      ...prev,
      elapsedMs: elapsed,
      isRunning: false,
      startedAt: null,
    }));
    setElapsedMs(elapsed);
  }, [clearTick, setStopwatch]);

  const resume = useCallback(() => {
    if (isRunningRef.current) return;
    hasLocalActionRef.current = true;
    const now = Date.now();
    startedAtRef.current = now - elapsedMsRef.current;
    isRunningRef.current = true;
    setStopwatch((prev) => ({
      ...prev,
      elapsedMs: elapsedMsRef.current,
      isRunning: true,
      startedAt: startedAtRef.current,
    }));
    startTick();
  }, [setStopwatch, startTick]);

  const reset = useCallback(() => {
    hasLocalActionRef.current = true;
    clearTick();
    startedAtRef.current = 0;
    elapsedMsRef.current = 0;
    isRunningRef.current = false;
    setElapsedMs(0);
    setStopwatch({
      elapsedMs: 0,
      isRunning: false,
      startedAt: null,
      laps: [],
    });
  }, [clearTick, setStopwatch]);

  const lap = useCallback(() => {
    if (!isRunningRef.current) return;
    hasLocalActionRef.current = true;
    const elapsed = Math.max(0, Date.now() - startedAtRef.current);
    elapsedMsRef.current = elapsed;
    setElapsedMs(elapsed);
    setStopwatch((prev) => ({
      ...prev,
      elapsedMs: elapsed,
      laps: [...prev.laps, elapsed],
    }));
  }, [setStopwatch]);

  useEffect(() => {
    return clearTick;
  }, [clearTick]);

  return {
    elapsedMs,
    isRunning: stopwatch.isRunning,
    laps: stopwatch.laps,
    start,
    pause,
    resume,
    reset,
    lap,
  };
}
