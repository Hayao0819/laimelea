import {
  getNext24HourTimestamp,
  getNextAlarmTimestamp,
  getNextCustomTimestamp,
} from "../../../../src/features/alarm/services/alarmTime";
import type { CycleConfig } from "../../../../src/models/CustomTime";

const cycleConfig: CycleConfig = {
  baseTimeMs: Date.parse("2026-01-01T00:00:00.000Z"),
  cycleLengthMinutes: 26 * 60,
};

describe("alarmTime", () => {
  it("uses the current custom cycle instead of day zero", () => {
    const now = Date.parse("2026-01-04T07:00:00.000Z");

    const result = getNextCustomTimestamp(
      { hours: 2, minutes: 0 },
      cycleConfig,
      now,
    );

    expect(result).toBe(Date.parse("2026-01-04T08:00:00.000Z"));
    expect(result).toBeGreaterThan(now);
  });

  it("moves a passed custom time to the next custom cycle", () => {
    const now = Date.parse("2026-01-04T09:00:00.000Z");

    const result = getNextCustomTimestamp(
      { hours: 2, minutes: 0 },
      cycleConfig,
      now,
    );

    expect(result).toBe(Date.parse("2026-01-05T10:00:00.000Z"));
  });

  it("handles times before the custom base time", () => {
    const now = cycleConfig.baseTimeMs - 60 * 60 * 1000;

    expect(
      getNextCustomTimestamp({ hours: 2, minutes: 0 }, cycleConfig, now),
    ).toBe(cycleConfig.baseTimeMs + 2 * 60 * 60 * 1000);
  });

  it("moves a time equal to now into the next custom cycle", () => {
    const now = cycleConfig.baseTimeMs + 2 * 60 * 60 * 1000;

    expect(
      getNextCustomTimestamp({ hours: 2, minutes: 0 }, cycleConfig, now),
    ).toBe(now + cycleConfig.cycleLengthMinutes * 60 * 1000);
  });

  it("keeps the selected time in the current cycle after many cycles", () => {
    const cycleLengthMs = cycleConfig.cycleLengthMinutes * 60 * 1000;
    const now = cycleConfig.baseTimeMs + 100 * cycleLengthMs + 60 * 60 * 1000;

    expect(
      getNextCustomTimestamp({ hours: 2, minutes: 0 }, cycleConfig, now),
    ).toBe(cycleConfig.baseTimeMs + 100 * cycleLengthMs + 2 * 60 * 60 * 1000);
  });

  it("moves a passed 24-hour time to tomorrow", () => {
    const now = Date.parse("2026-01-05T05:00:00.000Z");
    const expected = new Date(now);
    expected.setHours(2, 0, 0, 0);
    expected.setDate(expected.getDate() + 1);

    expect(getNext24HourTimestamp({ hours: 2, minutes: 0 }, now)).toBe(
      expected.getTime(),
    );
  });

  it("selects the correct calculation for each time system", () => {
    const now = Date.parse("2026-01-04T07:00:00.000Z");

    expect(
      getNextAlarmTimestamp(
        { hours: 2, minutes: 0 },
        "custom",
        cycleConfig,
        now,
      ),
    ).toBe(Date.parse("2026-01-04T08:00:00.000Z"));
    expect(
      getNextAlarmTimestamp({ hours: 2, minutes: 0 }, "24h", cycleConfig, now),
    ).toBe(getNext24HourTimestamp({ hours: 2, minutes: 0 }, now));
  });
});
