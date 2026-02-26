import { realToCustom, customToReal } from "../../../src/core/time/conversions";
import type { CycleConfig } from "../../../src/models/CustomTime";
import type { CustomTimeValue } from "../../../src/models/CustomTime";

// 26h cycle = 1560 minutes
const config26h: CycleConfig = {
  cycleLengthMinutes: 1560,
  baseTimeMs: new Date("2026-01-01T00:00:00Z").getTime(), // 1735689600000
};

// 24h cycle (standard)
const config24h: CycleConfig = {
  cycleLengthMinutes: 1440,
  baseTimeMs: new Date("2026-01-01T00:00:00Z").getTime(),
};

// 28h cycle
const config28h: CycleConfig = {
  cycleLengthMinutes: 1680,
  baseTimeMs: new Date("2026-01-01T00:00:00Z").getTime(),
};

describe("realToCustom", () => {
  it("should return day 0, 00:00:00 at exactly base time", () => {
    const result = realToCustom(config26h.baseTimeMs, config26h);
    expect(result).toEqual({ day: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("should handle 1 hour after base time", () => {
    const oneHourMs = 3600000;
    const result = realToCustom(config26h.baseTimeMs + oneHourMs, config26h);
    expect(result).toEqual({ day: 0, hours: 1, minutes: 0, seconds: 0 });
  });

  it("should handle 25 hours (still within day 0 for 26h cycle)", () => {
    const ms = 25 * 3600000;
    const result = realToCustom(config26h.baseTimeMs + ms, config26h);
    expect(result).toEqual({ day: 0, hours: 25, minutes: 0, seconds: 0 });
  });

  it("should roll over to day 1 after 26 hours", () => {
    const ms = 26 * 3600000;
    const result = realToCustom(config26h.baseTimeMs + ms, config26h);
    expect(result).toEqual({ day: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("should handle minutes and seconds correctly", () => {
    const ms = 2 * 3600000 + 30 * 60000 + 45000; // 2h 30m 45s
    const result = realToCustom(config26h.baseTimeMs + ms, config26h);
    expect(result).toEqual({ day: 0, hours: 2, minutes: 30, seconds: 45 });
  });

  it("should handle multiple days", () => {
    // 3 full 26h cycles + 5h 15m 30s
    const cycleLengthMs = 1560 * 60000;
    const ms = 3 * cycleLengthMs + 5 * 3600000 + 15 * 60000 + 30000;
    const result = realToCustom(config26h.baseTimeMs + ms, config26h);
    expect(result).toEqual({ day: 3, hours: 5, minutes: 15, seconds: 30 });
  });

  it("should handle time before base time (negative days)", () => {
    const oneHourMs = 3600000;
    const result = realToCustom(config26h.baseTimeMs - oneHourMs, config26h);
    expect(result.day).toBe(-1);
    expect(result.hours).toBe(25); // 26h - 1h = 25h into day -1
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it("should handle time exactly one cycle before base (day -1, 00:00:00)", () => {
    const cycleLengthMs = 1560 * 60000;
    const result = realToCustom(
      config26h.baseTimeMs - cycleLengthMs,
      config26h,
    );
    expect(result).toEqual({ day: -1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("should work correctly with standard 24h cycle", () => {
    const ms = 25 * 3600000; // 25 hours = day 1, 01:00:00
    const result = realToCustom(config24h.baseTimeMs + ms, config24h);
    expect(result).toEqual({ day: 1, hours: 1, minutes: 0, seconds: 0 });
  });

  it("should work with 28h cycle", () => {
    const ms = 28 * 3600000; // Exactly 1 cycle
    const result = realToCustom(config28h.baseTimeMs + ms, config28h);
    expect(result).toEqual({ day: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("should handle fractional cycle length (26h 30m = 1590 minutes)", () => {
    const config: CycleConfig = {
      cycleLengthMinutes: 1590, // 26h 30m
      baseTimeMs: config26h.baseTimeMs,
    };
    const ms = 1590 * 60000; // exactly 1 cycle
    const result = realToCustom(config.baseTimeMs + ms, config);
    expect(result).toEqual({ day: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("should handle large day numbers", () => {
    const cycleLengthMs = 1560 * 60000;
    const ms = 365 * cycleLengthMs; // day 365
    const result = realToCustom(config26h.baseTimeMs + ms, config26h);
    expect(result).toEqual({ day: 365, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe("customToReal", () => {
  it("should return base time for day 0, 00:00:00", () => {
    const custom: CustomTimeValue = {
      day: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    const result = customToReal(custom, config26h);
    expect(result).toBe(config26h.baseTimeMs);
  });

  it("should convert 1 hour correctly", () => {
    const custom: CustomTimeValue = {
      day: 0,
      hours: 1,
      minutes: 0,
      seconds: 0,
    };
    const result = customToReal(custom, config26h);
    expect(result).toBe(config26h.baseTimeMs + 3600000);
  });

  it("should convert day 1, 00:00:00 to exactly one cycle after base", () => {
    const custom: CustomTimeValue = {
      day: 1,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    const result = customToReal(custom, config26h);
    const cycleLengthMs = 1560 * 60000;
    expect(result).toBe(config26h.baseTimeMs + cycleLengthMs);
  });

  it("should handle minutes and seconds", () => {
    const custom: CustomTimeValue = {
      day: 0,
      hours: 2,
      minutes: 30,
      seconds: 45,
    };
    const result = customToReal(custom, config26h);
    const expected =
      config26h.baseTimeMs + 2 * 3600000 + 30 * 60000 + 45 * 1000;
    expect(result).toBe(expected);
  });

  it("should handle negative days", () => {
    const custom: CustomTimeValue = {
      day: -1,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    const result = customToReal(custom, config26h);
    const cycleLengthMs = 1560 * 60000;
    expect(result).toBe(config26h.baseTimeMs - cycleLengthMs);
  });

  it("should handle large day numbers", () => {
    const custom: CustomTimeValue = {
      day: 100,
      hours: 12,
      minutes: 30,
      seconds: 0,
    };
    const result = customToReal(custom, config26h);
    const cycleLengthMs = 1560 * 60000;
    const expected =
      config26h.baseTimeMs + 100 * cycleLengthMs + 12 * 3600000 + 30 * 60000;
    expect(result).toBe(expected);
  });
});

describe("roundtrip conversion", () => {
  const timestamps = [
    config26h.baseTimeMs,
    config26h.baseTimeMs + 3600000, // +1h
    config26h.baseTimeMs + 26 * 3600000, // +26h
    config26h.baseTimeMs + 100 * 1560 * 60000 + 12345678, // large offset
    config26h.baseTimeMs - 5 * 3600000, // before base
  ];

  it.each(timestamps)(
    "should roundtrip timestamp %d correctly",
    (timestamp) => {
      const custom = realToCustom(timestamp, config26h);
      const backToReal = customToReal(custom, config26h);
      // Should be accurate to the second (truncation of sub-second)
      expect(Math.abs(backToReal - timestamp)).toBeLessThan(1000);
    },
  );

  it("should roundtrip with different cycle lengths", () => {
    const configs = [config24h, config26h, config28h];
    const offset = 50 * 3600000 + 30 * 60000 + 15000; // 50h 30m 15s

    for (const cfg of configs) {
      const ts = cfg.baseTimeMs + offset;
      const custom = realToCustom(ts, cfg);
      const back = customToReal(custom, cfg);
      expect(Math.abs(back - ts)).toBeLessThan(1000);
    }
  });
});
