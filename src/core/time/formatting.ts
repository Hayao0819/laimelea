import type { CustomTimeValue } from "../../models/CustomTime";

function pad(n: number, width: number = 2): string {
  return String(n).padStart(width, "0");
}

interface FormatOptions {
  showSeconds?: boolean;
}

/**
 * Format a CustomTimeValue as HH:MM:SS or HH:MM.
 */
export function formatCustomTime(
  time: CustomTimeValue,
  options: FormatOptions = {},
): string {
  const { showSeconds = true } = options;
  const base = `${pad(time.hours)}:${pad(time.minutes)}`;
  return showSeconds ? `${base}:${pad(time.seconds)}` : base;
}

/**
 * Format a CustomTimeValue as HH:MM (no seconds).
 */
export function formatCustomTimeShort(time: CustomTimeValue): string {
  return formatCustomTime(time, { showSeconds: false });
}

/**
 * Format the day portion of a CustomTimeValue.
 */
export function formatCustomDay(time: CustomTimeValue): string {
  return `Day ${time.day}`;
}
