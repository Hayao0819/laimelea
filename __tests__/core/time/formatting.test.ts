import {
  formatCustomDay,
  formatCustomTime,
  formatCustomTimeShort,
} from "../../../src/core/time/formatting";
import type { CustomTimeValue } from "../../../src/models/CustomTime";

describe("formatCustomTime", () => {
  it("should format zero time as 00:00:00", () => {
    const time: CustomTimeValue = { day: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(formatCustomTime(time)).toBe("00:00:00");
  });

  it("should format single digit hours/minutes/seconds with padding", () => {
    const time: CustomTimeValue = { day: 0, hours: 5, minutes: 3, seconds: 7 };
    expect(formatCustomTime(time)).toBe("05:03:07");
  });

  it("should format double digit values", () => {
    const time: CustomTimeValue = {
      day: 0,
      hours: 25,
      minutes: 59,
      seconds: 59,
    };
    expect(formatCustomTime(time)).toBe("25:59:59");
  });

  it("should format without seconds when showSeconds is false", () => {
    const time: CustomTimeValue = {
      day: 0,
      hours: 14,
      minutes: 30,
      seconds: 45,
    };
    expect(formatCustomTime(time, { showSeconds: false })).toBe("14:30");
  });
});

describe("formatCustomTimeShort", () => {
  it("should format time without seconds", () => {
    const time: CustomTimeValue = {
      day: 0,
      hours: 14,
      minutes: 30,
      seconds: 0,
    };
    expect(formatCustomTimeShort(time)).toBe("14:30");
  });
});

describe("formatCustomDay", () => {
  it("should format positive day", () => {
    const time: CustomTimeValue = { day: 5, hours: 0, minutes: 0, seconds: 0 };
    expect(formatCustomDay(time)).toBe("Day 5");
  });

  it("should format day 0", () => {
    const time: CustomTimeValue = { day: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(formatCustomDay(time)).toBe("Day 0");
  });

  it("should format negative day", () => {
    const time: CustomTimeValue = { day: -3, hours: 0, minutes: 0, seconds: 0 };
    expect(formatCustomDay(time)).toBe("Day -3");
  });
});
