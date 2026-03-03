import type { CustomTimeValue,CycleConfig } from "../../models/CustomTime";
import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from "./constants";

/**
 * Convert a real-time Unix timestamp (ms) to a CustomTimeValue.
 * Handles times before baseTimeMs (negative day numbers).
 */
export function realToCustom(
  realTimestampMs: number,
  config: CycleConfig,
): CustomTimeValue {
  const cycleLengthMs = config.cycleLengthMinutes * MS_PER_MINUTE;
  const elapsedMs = realTimestampMs - config.baseTimeMs;

  const day = Math.floor(elapsedMs / cycleLengthMs);
  const remainder = elapsedMs - day * cycleLengthMs; // always non-negative

  const hours = Math.floor(remainder / MS_PER_HOUR);
  const minutes = Math.floor((remainder % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((remainder % MS_PER_MINUTE) / MS_PER_SECOND);

  return { day, hours, minutes, seconds };
}

/**
 * Convert a CustomTimeValue back to a real-time Unix timestamp (ms).
 */
export function customToReal(
  customTime: CustomTimeValue,
  config: CycleConfig,
): number {
  const cycleLengthMs = config.cycleLengthMinutes * MS_PER_MINUTE;
  const totalMs =
    customTime.day * cycleLengthMs +
    customTime.hours * MS_PER_HOUR +
    customTime.minutes * MS_PER_MINUTE +
    customTime.seconds * MS_PER_SECOND;

  return config.baseTimeMs + totalMs;
}
