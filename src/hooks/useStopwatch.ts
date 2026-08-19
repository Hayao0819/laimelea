import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { stopwatchAtom, stopwatchHydratedAtom } from "../atoms/timerAtoms";
import {
  type ElapsedRealtimeSnapshot,
  hasElapsedRealtimeSnapshot,
  readElapsedRealtimeSnapshot,
} from "../features/timer/services/elapsedRealtime";
import type { StopwatchState } from "../models/Timer";

const TICK_INTERVAL = 50;

export interface UseStopwatchReturn {
  elapsedMs: number;
  isRunning: boolean;
  laps: number[];
  isHydrated?: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  lap: () => void;
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function useStopwatch(): UseStopwatchReturn {
  const [stopwatch, setStopwatch] = useAtom(stopwatchAtom);
  const isHydrated = useAtomValue(stopwatchHydratedAtom);
  const [elapsedMs, setElapsedMs] = useState(stopwatch.elapsedMs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const wallStartedAtRef = useRef<number | null>(stopwatch.startedAt);
  const elapsedMsRef = useRef(stopwatch.elapsedMs);
  const isRunningRef = useRef(false);
  const hasLocalActionRef = useRef(false);
  const stopwatchRef = useRef(stopwatch);
  const mutationVersionRef = useRef(0);
  const resyncVersionRef = useRef(0);
  const elapsedClockRef = useRef<{
    snapshot: ElapsedRealtimeSnapshot;
    runtimeAtSnapshot: number;
  } | null>(null);
  const [isElapsedClockReady, setElapsedClockReady] = useState(
    () => !hasElapsedRealtimeSnapshot(),
  );

  const elapsedRealtimeNow = useCallback((): number | null => {
    const clock = elapsedClockRef.current;
    if (clock === null) return null;
    return Math.max(
      0,
      clock.snapshot.elapsedRealtimeMs +
        (monotonicNow() - clock.runtimeAtSnapshot),
    );
  }, []);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!isRunningRef.current) return;
    const monotonicElapsed = Math.max(0, monotonicNow() - startedAtRef.current);
    const elapsed =
      monotonicElapsed > 0 || wallStartedAtRef.current === null
        ? monotonicElapsed
        : Math.max(0, Date.now() - wallStartedAtRef.current);
    elapsedMsRef.current = elapsed;
    setElapsedMs(elapsed);
  }, []);

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(tick, TICK_INTERVAL);
  }, [clearTick, tick]);

  const restoreRuntimeState = useCallback(
    (state: StopwatchState) => {
      stopwatchRef.current = state;
      if (state.isRunning && state.startedAt !== null) {
        const nativeNow = elapsedRealtimeNow();
        const persistedElapsedStart = state.startedAtElapsedMs;
        const canUseElapsedClock =
          nativeNow !== null &&
          persistedElapsedStart !== null &&
          persistedElapsedStart !== undefined &&
          state.bootCount === elapsedClockRef.current?.snapshot.bootCount;
        const elapsed = canUseElapsedClock
          ? Math.max(state.elapsedMs, nativeNow - persistedElapsedStart)
          : Math.max(state.elapsedMs, Date.now() - state.startedAt);
        startedAtRef.current = monotonicNow() - elapsed;
        wallStartedAtRef.current = state.startedAt;
        elapsedMsRef.current = elapsed;
        isRunningRef.current = true;
        setElapsedMs(elapsed);
        startTick();
        return;
      }

      clearTick();
      startedAtRef.current = 0;
      wallStartedAtRef.current = null;
      elapsedMsRef.current = state.elapsedMs;
      isRunningRef.current = false;
      setElapsedMs(state.elapsedMs);
    },
    [clearTick, elapsedRealtimeNow, startTick],
  );

  const commitStopwatch = useCallback(
    (next: StopwatchState, previous: StopwatchState) => {
      const version = ++mutationVersionRef.current;
      stopwatchRef.current = next;
      Promise.resolve(setStopwatch(next)).then(
        () => {
          if (mutationVersionRef.current === version) {
            hasLocalActionRef.current = false;
          }
        },
        () => {
          if (mutationVersionRef.current !== version) return;
          hasLocalActionRef.current = false;
          restoreRuntimeState(previous);
          Promise.resolve(setStopwatch(previous)).catch(() => undefined);
        },
      );
    },
    [restoreRuntimeState, setStopwatch],
  );

  useEffect(() => {
    if (!hasElapsedRealtimeSnapshot()) return;
    let mounted = true;
    readElapsedRealtimeSnapshot().then((snapshot) => {
      if (!mounted) return;
      if (snapshot !== null) {
        elapsedClockRef.current = {
          snapshot,
          runtimeAtSnapshot: monotonicNow(),
        };
      }
      setElapsedClockReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    stopwatchRef.current = stopwatch;
    if (!isHydrated || !isElapsedClockReady || hasLocalActionRef.current) {
      return;
    }

    if (stopwatch.isRunning && stopwatch.startedAt !== null) {
      restoreRuntimeState(stopwatch);
    } else if (!stopwatch.isRunning) {
      restoreRuntimeState(stopwatch);
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
  }, [
    clearTick,
    isElapsedClockReady,
    isHydrated,
    restoreRuntimeState,
    setStopwatch,
    stopwatch,
  ]);

  useEffect(() => {
    let mounted = true;
    const handleAppState = (state: AppStateStatus) => {
      if (state !== "active" || !isRunningRef.current) return;
      if (!hasElapsedRealtimeSnapshot()) {
        tick();
        return;
      }
      const version = ++resyncVersionRef.current;
      readElapsedRealtimeSnapshot().then((snapshot) => {
        if (
          !mounted ||
          !isRunningRef.current ||
          resyncVersionRef.current !== version
        ) {
          return;
        }
        if (snapshot !== null) {
          elapsedClockRef.current = {
            snapshot,
            runtimeAtSnapshot: monotonicNow(),
          };
        }
        restoreRuntimeState(stopwatchRef.current);
      });
    };
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [restoreRuntimeState, tick]);

  const start = useCallback(() => {
    if (!isHydrated || !isElapsedClockReady) return;
    const previous = stopwatchRef.current;
    hasLocalActionRef.current = true;
    const now = monotonicNow();
    const wallNow = Date.now();
    const nativeNow = elapsedRealtimeNow();
    startedAtRef.current = now;
    wallStartedAtRef.current = wallNow;
    elapsedMsRef.current = 0;
    isRunningRef.current = true;
    setElapsedMs(0);
    commitStopwatch(
      {
        elapsedMs: 0,
        isRunning: true,
        startedAt: wallNow,
        ...(nativeNow === null
          ? {}
          : {
              startedAtElapsedMs: nativeNow,
              bootCount: elapsedClockRef.current?.snapshot.bootCount,
            }),
        laps: [],
      },
      previous,
    );
    startTick();
  }, [
    commitStopwatch,
    elapsedRealtimeNow,
    isElapsedClockReady,
    isHydrated,
    startTick,
  ]);

  const pause = useCallback(() => {
    if (!isHydrated || !isElapsedClockReady || !isRunningRef.current) return;
    const previous = stopwatchRef.current;
    hasLocalActionRef.current = true;
    tick();
    const elapsed = elapsedMsRef.current;
    elapsedMsRef.current = elapsed;
    isRunningRef.current = false;
    wallStartedAtRef.current = null;
    clearTick();
    commitStopwatch(
      {
        ...previous,
        elapsedMs: elapsed,
        isRunning: false,
        startedAt: null,
        startedAtElapsedMs: null,
        bootCount: null,
      },
      previous,
    );
    setElapsedMs(elapsed);
  }, [clearTick, commitStopwatch, isElapsedClockReady, isHydrated, tick]);

  const resume = useCallback(() => {
    if (!isHydrated || !isElapsedClockReady || isRunningRef.current) return;
    const previous = stopwatchRef.current;
    hasLocalActionRef.current = true;
    startedAtRef.current = monotonicNow() - elapsedMsRef.current;
    wallStartedAtRef.current = Date.now() - elapsedMsRef.current;
    const nativeNow = elapsedRealtimeNow();
    isRunningRef.current = true;
    commitStopwatch(
      {
        ...previous,
        elapsedMs: elapsedMsRef.current,
        isRunning: true,
        startedAt: wallStartedAtRef.current,
        ...(nativeNow === null
          ? {}
          : {
              startedAtElapsedMs: nativeNow - elapsedMsRef.current,
              bootCount: elapsedClockRef.current?.snapshot.bootCount,
            }),
      },
      previous,
    );
    startTick();
  }, [
    commitStopwatch,
    elapsedRealtimeNow,
    isElapsedClockReady,
    isHydrated,
    startTick,
  ]);

  const reset = useCallback(() => {
    if (!isHydrated || !isElapsedClockReady) return;
    const previous = stopwatchRef.current;
    hasLocalActionRef.current = true;
    clearTick();
    startedAtRef.current = 0;
    wallStartedAtRef.current = null;
    elapsedMsRef.current = 0;
    isRunningRef.current = false;
    setElapsedMs(0);
    commitStopwatch(
      {
        elapsedMs: 0,
        isRunning: false,
        startedAt: null,
        startedAtElapsedMs: null,
        bootCount: null,
        laps: [],
      },
      previous,
    );
  }, [clearTick, commitStopwatch, isElapsedClockReady, isHydrated]);

  const lap = useCallback(() => {
    if (!isHydrated || !isElapsedClockReady || !isRunningRef.current) return;
    const previous = stopwatchRef.current;
    hasLocalActionRef.current = true;
    tick();
    const elapsed = elapsedMsRef.current;
    commitStopwatch(
      {
        ...previous,
        elapsedMs: elapsed,
        laps: [...previous.laps, elapsed],
      },
      previous,
    );
  }, [commitStopwatch, isElapsedClockReady, isHydrated, tick]);

  useEffect(() => {
    return clearTick;
  }, [clearTick]);

  return {
    elapsedMs,
    isRunning: stopwatch.isRunning,
    laps: stopwatch.laps,
    isHydrated: isHydrated && isElapsedClockReady,
    start,
    pause,
    resume,
    reset,
    lap,
  };
}
