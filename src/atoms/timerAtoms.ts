import { atom } from "jotai";
import type { TimerState, StopwatchState } from "../models/Timer";

export const timerAtom = atom<TimerState | null>(null);

export const stopwatchAtom = atom<StopwatchState>({
  elapsedMs: 0,
  isRunning: false,
  startedAt: null,
  laps: [],
});
