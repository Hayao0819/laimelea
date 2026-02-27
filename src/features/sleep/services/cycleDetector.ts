import type {
  CycleEstimation,
  SleepSession,
} from "../../../models/SleepSession";

const MINUTES_PER_DAY = 1440;
const MIN_DATA_POINTS = 7;

function getConfidence(dataPoints: number): "low" | "medium" | "high" | null {
  if (dataPoints < MIN_DATA_POINTS) return null;
  if (dataPoints < 14) return "low";
  if (dataPoints < 28) return "medium";
  return "high";
}

function toMinuteOfDay(timestampMs: number): number {
  const date = new Date(timestampMs);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Compute the shortest signed angular difference between two
 * minute-of-day values on a circular 0..1440 scale.
 * Returns a value in the range (-720, 720].
 */
function circularDiff(current: number, previous: number): number {
  let diff = current - previous;
  while (diff > MINUTES_PER_DAY / 2) diff -= MINUTES_PER_DAY;
  while (diff <= -MINUTES_PER_DAY / 2) diff += MINUTES_PER_DAY;
  return diff;
}

function linearRegression(
  xs: number[],
  ys: number[],
): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = xs.length;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssTot += dy * dy;
  }

  if (ssXX === 0) {
    return { slope: 0, intercept: meanY, r2: ssTot === 0 ? 1 : 0 };
  }

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
  }

  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Unwrap sleep onset minutes using circular (shortest-path) differences
 * so that both forward and backward drift are correctly tracked.
 * Day indices are ordinal (0, 1, 2, ...) representing successive
 * observations.
 */
function unwrapOnsetMinutes(sorted: SleepSession[]): {
  dayIndices: number[];
  unwrapped: number[];
} {
  const dayIndices: number[] = [];
  const unwrapped: number[] = [];

  const firstMinute = toMinuteOfDay(sorted[0].startTimestampMs);
  unwrapped.push(firstMinute);
  dayIndices.push(0);

  let cumulativeMinutes = firstMinute;
  let prevMinute = firstMinute;

  for (let i = 1; i < sorted.length; i++) {
    const minute = toMinuteOfDay(sorted[i].startTimestampMs);
    const delta = circularDiff(minute, prevMinute);
    cumulativeMinutes += delta;
    unwrapped.push(cumulativeMinutes);
    dayIndices.push(i);
    prevMinute = minute;
  }

  return { dayIndices, unwrapped };
}

export function estimateCycle(
  sessions: SleepSession[],
): CycleEstimation | null {
  if (sessions.length < MIN_DATA_POINTS) return null;

  const sorted = [...sessions].sort(
    (a, b) => a.startTimestampMs - b.startTimestampMs,
  );

  const { dayIndices, unwrapped } = unwrapOnsetMinutes(sorted);
  const { slope, r2 } = linearRegression(dayIndices, unwrapped);

  const confidence = getConfidence(sorted.length);
  if (confidence == null) return null;

  return {
    periodMinutes: MINUTES_PER_DAY + slope,
    driftMinutesPerDay: slope,
    r2: Math.max(0, r2),
    confidence,
    dataPointsUsed: sorted.length,
  };
}
