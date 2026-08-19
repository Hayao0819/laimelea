export interface TimerState {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  isRunning: boolean;
  startedAt: number | null;
  pausedElapsedMs: number;
}

export interface StopwatchState {
  elapsedMs: number;
  isRunning: boolean;
  startedAt: number | null;
  startedAtElapsedMs?: number | null;
  bootCount?: number | null;
  laps: number[];
}
