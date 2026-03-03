import {
  generateBulkAlarms,
  ANDROID_ALARM_TRIGGER_LIMIT,
} from "../../../../src/features/alarm/services/bulkAlarmCreator";
import type { BulkAlarmParams } from "../../../../src/models/Alarm";
import type { CycleConfig } from "../../../../src/models/CustomTime";
import type { AlarmDefaults } from "../../../../src/models/Settings";
import { DEFAULT_ALARM_DEFAULTS } from "../../../../src/models/Settings";

const defaultCycleConfig: CycleConfig = {
  cycleLengthMinutes: 1560, // 26 hours
  baseTimeMs: 0,
};

const defaults: AlarmDefaults = { ...DEFAULT_ALARM_DEFAULTS };

function makeParams(overrides: Partial<BulkAlarmParams> = {}): BulkAlarmParams {
  return {
    fromHour: 7,
    fromMinute: 0,
    toHour: 9,
    toMinute: 0,
    intervalMinutes: 30,
    timeSystem: "24h",
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    mathDifficulty: 1,
    label: "Bulk",
    ...overrides,
  };
}

describe("generateBulkAlarms", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set a fixed "now" to avoid flaky past-time adjustments
    jest.setSystemTime(new Date("2026-02-26T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should generate 5 alarms for 24h from=07:00 to=09:00 interval=30", () => {
    const params = makeParams();
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    // 07:00, 07:30, 08:00, 08:30, 09:00 = 5
    expect(result.alarms).toHaveLength(5);
    expect(result.warning).toBeNull();
  });

  it("should generate 3 alarms for custom from=02:00 to=04:00 interval=60", () => {
    const params = makeParams({
      fromHour: 2,
      fromMinute: 0,
      toHour: 4,
      toMinute: 0,
      intervalMinutes: 60,
      timeSystem: "custom",
    });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    // 02:00, 03:00, 04:00 = 3
    expect(result.alarms).toHaveLength(3);
    expect(result.alarms[0].setInTimeSystem).toBe("custom");
  });

  it("should generate 1 alarm when from == to", () => {
    const params = makeParams({
      fromHour: 8,
      fromMinute: 0,
      toHour: 8,
      toMinute: 0,
      intervalMinutes: 30,
    });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    expect(result.alarms).toHaveLength(1);
  });

  it("should generate 1 alarm when interval > range", () => {
    const params = makeParams({
      fromHour: 8,
      fromMinute: 0,
      toHour: 8,
      toMinute: 30,
      intervalMinutes: 60,
    });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    expect(result.alarms).toHaveLength(1);
  });

  it("should handle 24h wraparound: from=23:00 to=01:00 interval=30", () => {
    const params = makeParams({
      fromHour: 23,
      fromMinute: 0,
      toHour: 1,
      toMinute: 0,
      intervalMinutes: 30,
    });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    // 23:00, 23:30, 00:00, 00:30, 01:00 = 5
    expect(result.alarms).toHaveLength(5);
  });

  it("should handle custom wraparound: from=25:00 to=01:00 interval=60, cycle=26h", () => {
    const params = makeParams({
      fromHour: 25,
      fromMinute: 0,
      toHour: 1,
      toMinute: 0,
      intervalMinutes: 60,
      timeSystem: "custom",
    });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    // 25:00, 00:00, 01:00 = 3 (wraps at 1560min = 26h)
    expect(result.alarms).toHaveLength(3);
  });

  it("should set warning when total alarms reach the limit", () => {
    const params = makeParams({
      fromHour: 7,
      fromMinute: 0,
      toHour: 9,
      toMinute: 0,
      intervalMinutes: 30,
    });
    const result = generateBulkAlarms(
      params,
      defaultCycleConfig,
      defaults,
      ANDROID_ALARM_TRIGGER_LIMIT - 3,
    );

    // 5 alarms + (50-3)=47 existing = 52 >= 50
    expect(result.warning).toBe("alarm.bulkWarningLimit");
  });

  it("should not set warning when under limit", () => {
    const params = makeParams();
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    expect(result.warning).toBeNull();
  });

  it("should return empty array when interval is 0", () => {
    const params = makeParams({ intervalMinutes: 0 });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    expect(result.alarms).toHaveLength(0);
  });

  it("should return empty array when interval is negative", () => {
    const params = makeParams({ intervalMinutes: -10 });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    expect(result.alarms).toHaveLength(0);
  });

  it("should generate unique IDs for all alarms", () => {
    const params = makeParams();
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    const ids = result.alarms.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should inherit properties from params and defaults", () => {
    const params = makeParams({
      dismissalMethod: "math",
      gradualVolumeDurationSec: 60,
      label: "Test Label",
    });
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    for (const alarm of result.alarms) {
      expect(alarm.dismissalMethod).toBe("math");
      expect(alarm.gradualVolumeDurationSec).toBe(60);
      expect(alarm.label).toBe("Test Label");
      expect(alarm.snoozeDurationMin).toBe(defaults.snoozeDurationMin);
      expect(alarm.snoozeMaxCount).toBe(defaults.snoozeMaxCount);
      expect(alarm.vibrationEnabled).toBe(defaults.vibrationEnabled);
      expect(alarm.notifeeTriggerId).toBeNull();
      expect(alarm.enabled).toBe(true);
    }
  });

  it("should set all alarms to enabled with null notifeeTriggerId", () => {
    const params = makeParams();
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    for (const alarm of result.alarms) {
      expect(alarm.enabled).toBe(true);
      expect(alarm.notifeeTriggerId).toBeNull();
    }
  });

  it("should produce valid targetTimestampMs for all alarms", () => {
    const params = makeParams();
    const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

    for (const alarm of result.alarms) {
      expect(typeof alarm.targetTimestampMs).toBe("number");
      expect(alarm.targetTimestampMs).toBeGreaterThan(0);
    }
  });

  describe("new alarm params", () => {
    it("should use snoozeDurationMin from params instead of defaults", () => {
      const params = makeParams({ snoozeDurationMin: 10 });
      const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

      expect(result.alarms.length).toBeGreaterThan(0);
      for (const alarm of result.alarms) {
        expect(alarm.snoozeDurationMin).toBe(10);
      }
    });

    it("should use snoozeMaxCount from params instead of defaults", () => {
      const params = makeParams({ snoozeMaxCount: 5 });
      const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

      expect(result.alarms.length).toBeGreaterThan(0);
      for (const alarm of result.alarms) {
        expect(alarm.snoozeMaxCount).toBe(5);
      }
    });

    it("should include mathDifficulty from params in generated alarms", () => {
      const params = makeParams({ mathDifficulty: 2 });
      const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

      expect(result.alarms.length).toBeGreaterThan(0);
      for (const alarm of result.alarms) {
        expect(alarm.mathDifficulty).toBe(2);
      }
    });

    it("should support mathDifficulty level 3", () => {
      const params = makeParams({ mathDifficulty: 3 });
      const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

      expect(result.alarms.length).toBeGreaterThan(0);
      for (const alarm of result.alarms) {
        expect(alarm.mathDifficulty).toBe(3);
      }
    });

    it("should propagate all new params to every generated alarm", () => {
      const params = makeParams({
        snoozeDurationMin: 15,
        snoozeMaxCount: 10,
        mathDifficulty: 3,
      });
      const result = generateBulkAlarms(params, defaultCycleConfig, defaults, 0);

      expect(result.alarms.length).toBeGreaterThan(0);
      for (const alarm of result.alarms) {
        expect(alarm.snoozeDurationMin).toBe(15);
        expect(alarm.snoozeMaxCount).toBe(10);
        expect(alarm.mathDifficulty).toBe(3);
      }
    });
  });
});
