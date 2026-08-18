import { TZDate, tzOffset } from "@date-fns/tz";
import { format } from "date-fns";

import type { AppSettings } from "../../models/Settings";

function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function resolveTimeZone(timeZone: string): string {
  if (timeZone === "auto") return systemTimeZone();

  try {
    if (!Number.isFinite(new TZDate(Date.now(), timeZone).getTime())) {
      return systemTimeZone();
    }
    return timeZone;
  } catch {
    return systemTimeZone();
  }
}

function fixedOffsetTimeZone(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function standardOffsetMinutes(timeZone: string, timestampMs: number): number {
  const year = new TZDate(timestampMs, timeZone).getFullYear();
  const january = tzOffset(timeZone, new Date(Date.UTC(year, 0, 1)));
  const july = tzOffset(timeZone, new Date(Date.UTC(year, 6, 1)));
  return Math.min(january, july);
}

export function getDisplayDate(
  timestampMs: number,
  settings: Pick<AppSettings, "timezone" | "dstHandling">,
): TZDate {
  const timeZone = resolveTimeZone(settings.timezone);
  const displayTimeZone =
    settings.dstHandling === "ignore"
      ? fixedOffsetTimeZone(standardOffsetMinutes(timeZone, timestampMs))
      : timeZone;
  return new TZDate(timestampMs, displayTimeZone);
}

export function formatDisplayTime(
  timestampMs: number,
  settings: Pick<AppSettings, "timezone" | "dstHandling" | "timeFormat">,
): string {
  return format(
    getDisplayDate(timestampMs, settings),
    settings.timeFormat === "12h" ? "hh:mm:ss a" : "HH:mm:ss",
  );
}

export function formatTimeInZone(
  timestampMs: number,
  timeZone: string,
  timeFormat: AppSettings["timeFormat"],
): string {
  return format(
    new TZDate(timestampMs, resolveTimeZone(timeZone)),
    timeFormat === "12h" ? "hh:mm:ss a" : "HH:mm:ss",
  );
}
