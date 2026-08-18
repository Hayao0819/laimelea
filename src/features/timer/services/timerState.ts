import type { TimerState } from "../../../models/Timer";

export function completeTimers(
  timers: TimerState[],
  completedTimerIds: Iterable<string>,
): TimerState[] {
  const completedIds = new Set(completedTimerIds);
  return timers.map((timer) =>
    completedIds.has(timer.id) && timer.isRunning
      ? { ...timer, remainingMs: 0, isRunning: false, startedAt: null }
      : timer,
  );
}
