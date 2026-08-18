import { completeTimers } from "../../../../src/features/timer/services/timerState";
import type { TimerState } from "../../../../src/models/Timer";

function makeTimer(overrides: Partial<TimerState> = {}): TimerState {
  return {
    id: "timer-1",
    label: "Timer",
    durationMs: 60_000,
    remainingMs: 30_000,
    isRunning: true,
    startedAt: 1000,
    pausedElapsedMs: 0,
    ...overrides,
  };
}

describe("completeTimers", () => {
  it("completes only running timers included in the delivery", () => {
    const running = makeTimer();
    const other = makeTimer({ id: "timer-2" });

    expect(completeTimers([running, other], [running.id])).toEqual([
      { ...running, remainingMs: 0, isRunning: false, startedAt: null },
      other,
    ]);
  });

  it("leaves an already completed timer unchanged", () => {
    const completed = makeTimer({
      remainingMs: 0,
      isRunning: false,
      startedAt: null,
    });

    expect(completeTimers([completed], [completed.id])[0]).toBe(completed);
  });
});
