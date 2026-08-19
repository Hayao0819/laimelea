export function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfLocalDay(ms: number): number {
  const date = new Date(startOfLocalDay(ms));
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function startOfLocalWeek(ms: number, firstDayOfWeek: number): number {
  const date = new Date(startOfLocalDay(ms));
  const daysSinceWeekStart = (date.getDay() - firstDayOfWeek + 7) % 7;
  date.setDate(date.getDate() - daysSinceWeekStart);
  return date.getTime();
}

export function intersectsLocalDay(
  startTimestampMs: number,
  endTimestampMs: number,
  dayStartMs: number,
): boolean {
  return (
    startTimestampMs < endOfLocalDay(dayStartMs) &&
    endTimestampMs > startOfLocalDay(dayStartMs)
  );
}

export function weekdayOrder(firstDayOfWeek: number): number[] {
  return Array.from({ length: 7 }, (_, index) => (firstDayOfWeek + index) % 7);
}
