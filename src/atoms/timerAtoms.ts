import { atom } from "jotai";
import type { TimerState, StopwatchState } from "../models/Timer";

export const timersAtom = atom<TimerState[]>([]);

export const stopwatchAtom = atom<StopwatchState>({
  elapsedMs: 0,
  isRunning: false,
  startedAt: null,
  laps: [],
});
