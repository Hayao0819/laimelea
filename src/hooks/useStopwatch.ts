import { useCallback, useEffect, useRef } from "react";
import { useAtom } from "jotai";
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

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    previousElapsedRef.current = 0;
    setStopwatch({
      elapsedMs: 0,
      isRunning: true,
      startedAt: Date.now(),
      laps: [],
    });
    startTick();
  }, [setStopwatch, startTick]);

  const pause = useCallback(() => {
    if (!stopwatch.isRunning) return;
    previousElapsedRef.current += Date.now() - startedAtRef.current;
    clearTick();
    setStopwatch((prev) => ({ ...prev, isRunning: false }));
  }, [stopwatch.isRunning, clearTick, setStopwatch]);

  const resume = useCallback(() => {
    if (stopwatch.isRunning) return;
    startedAtRef.current = Date.now();
    setStopwatch((prev) => ({ ...prev, isRunning: true }));
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
