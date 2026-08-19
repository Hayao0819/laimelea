import { getCalendarDayOffset } from "../../../src/features/sleep/components/SleepDriftChart";

describe("getCalendarDayOffset", () => {
  it("keeps consecutive calendar days one unit apart across DST", () => {
    const beforeDst = new Date("2026-03-08T00:00:00-05:00").getTime();
    const afterDst = new Date("2026-03-09T00:00:00-04:00").getTime();

    expect(getCalendarDayOffset(afterDst, beforeDst)).toBe(1);
  });
});
