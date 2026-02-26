export interface TimerState {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  isRunning: boolean;
  startedAt: number | null;
}

export interface StopwatchState {
  elapsedMs: number;
  isRunning: boolean;
  startedAt: number | null;
  laps: number[];
}
