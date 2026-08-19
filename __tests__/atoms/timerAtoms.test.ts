import {
  normalizeStopwatch,
  normalizeTimers,
} from "../../src/core/storage/timerState";

describe("timer persistence normalization", () => {
  it("keeps valid timers and drops corrupted records", () => {
    const valid = {
      id: "timer-1",
      label: "Tea",
      durationMs: 60_000,
      remainingMs: 60_000,
      isRunning: true,
      startedAt: 1_700_000_000_000,
      pausedElapsedMs: 0,
    };

    expect(
      normalizeTimers([
        valid,
        null,
        { ...valid, durationMs: Infinity },
        { ...valid, durationMs: Number.MAX_SAFE_INTEGER + 1 },
      ]),
    ).toEqual([valid]);
    expect(normalizeTimers({ timers: [] })).toEqual([]);
  });

  it("drops timers whose displayed and scheduled remaining times disagree", () => {
    const timer = {
      id: "timer-1",
      label: "Tea",
      durationMs: 60_000,
      remainingMs: 1_000,
      isRunning: false,
      startedAt: null,
      pausedElapsedMs: 0,
    };

    expect(normalizeTimers([timer])).toEqual([]);
  });

  it("normalizes completed timers saved by older versions", () => {
    const timer = {
      id: "timer-1",
      label: "Tea",
      durationMs: 60_000,
      remainingMs: 0,
      isRunning: false,
      startedAt: null,
      pausedElapsedMs: 0,
    };

    expect(normalizeTimers([timer])).toEqual([
      { ...timer, pausedElapsedMs: 60_000 },
    ]);
  });

  it("replaces a corrupted stopwatch with its initial state", () => {
    expect(
      normalizeStopwatch({
        elapsedMs: Infinity,
        isRunning: true,
        startedAt: null,
        laps: [],
      }),
    ).toEqual({
      elapsedMs: 0,
      isRunning: false,
      startedAt: null,
      laps: [],
    });
  });

  it("drops incomplete elapsed-clock metadata from a stopwatch", () => {
    expect(
      normalizeStopwatch({
        elapsedMs: 1_000,
        isRunning: true,
        startedAt: 10_000,
        startedAtElapsedMs: 5_000,
        laps: [],
      }),
    ).toEqual({
      elapsedMs: 1_000,
      isRunning: true,
      startedAt: 10_000,
      laps: [],
    });
  });
});
