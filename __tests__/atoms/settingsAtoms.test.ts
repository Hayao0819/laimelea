import { createStore } from "jotai";
import {
  settingsAtom,
  resolvedSettingsAtom,
  settingsLoadedAtom,
  cycleConfigAtom,
  setupCompleteAtom,
  primaryTimeDisplayAtom,
} from "../../src/atoms/settingsAtoms";
import {
  DEFAULT_SETTINGS,
  DEFAULT_ALARM_DEFAULTS,
} from "../../src/models/Settings";
import type { AppSettings, AlarmDefaults } from "../../src/models/Settings";
import { DEFAULT_CYCLE_LENGTH_MINUTES } from "../../src/core/time/constants";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

function createInitializedStore() {
  const store = createStore();
  // atomWithStorage + async storage needs explicit init for sync tests
  store.set(settingsAtom, DEFAULT_SETTINGS);
  return store;
}

describe("cycleConfigAtom", () => {
  it("should return default cycleConfig", () => {
    const store = createInitializedStore();
    const config = store.get(cycleConfigAtom);
    expect(config).toEqual({
      cycleLengthMinutes: DEFAULT_CYCLE_LENGTH_MINUTES,
      baseTimeMs: 0,
    });
  });
});

describe("setupCompleteAtom", () => {
  it("should return false by default", () => {
    const store = createInitializedStore();
    const complete = store.get(setupCompleteAtom);
    expect(complete).toBe(false);
  });
});

describe("primaryTimeDisplayAtom", () => {
  it("should return 'custom' by default", () => {
    const store = createInitializedStore();
    const display = store.get(primaryTimeDisplayAtom);
    expect(display).toBe("custom");
  });

  it("should update settingsAtom.primaryTimeDisplay on write", () => {
    const store = createInitializedStore();
    store.set(primaryTimeDisplayAtom, "24h");
    const display = store.get(primaryTimeDisplayAtom);
    expect(display).toBe("24h");
    const settings = store.get(settingsAtom) as AppSettings;
    expect(settings.primaryTimeDisplay).toBe("24h");
  });

  it("should reflect settingsAtom updates", () => {
    const store = createInitializedStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "24h",
    });
    const display = store.get(primaryTimeDisplayAtom);
    expect(display).toBe("24h");
  });
});

describe("settingsLoadedAtom", () => {
  it("should return true when settingsAtom is explicitly set", () => {
    const store = createInitializedStore();
    const loaded = store.get(settingsLoadedAtom);
    expect(loaded).toBe(true);
  });

  it("should return false when settingsAtom has not been explicitly set", () => {
    // A fresh store where settingsAtom has not been set via store.set().
    // atomWithStorage + getOnInit starts an async read from AsyncStorage,
    // so the unwrapped value is still the LOADING sentinel at this point.
    const store = createStore();
    const loaded = store.get(settingsLoadedAtom);
    expect(loaded).toBe(false);
  });

  it("should return true after settingsAtom is explicitly set on a store", () => {
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    expect(store.get(settingsLoadedAtom)).toBe(true);
  });
});

describe("resolvedSettingsAtom", () => {
  it("returns DEFAULT_SETTINGS when no stored value", () => {
    const store = createInitializedStore();
    const resolved = store.get(resolvedSettingsAtom);
    expect(resolved).toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored settings with defaults for top-level fields", () => {
    const store = createStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      theme: "dark",
      timeFormat: "12h",
    });
    const resolved = store.get(resolvedSettingsAtom);
    expect(resolved.theme).toBe("dark");
    expect(resolved.timeFormat).toBe("12h");
    // Unchanged top-level fields retain defaults
    expect(resolved.language).toBe(DEFAULT_SETTINGS.language);
    expect(resolved.setupComplete).toBe(DEFAULT_SETTINGS.setupComplete);
  });

  it("deep-merges alarmDefaults when stored value has partial alarmDefaults", () => {
    const store = createStore();
    // Simulate stored settings with only dismissalMethod in alarmDefaults
    const partialAlarmDefaults = {
      dismissalMethod: "math" as const,
    };
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      alarmDefaults: partialAlarmDefaults as AlarmDefaults,
    });
    const resolved = store.get(resolvedSettingsAtom);
    // Stored value is preserved
    expect(resolved.alarmDefaults.dismissalMethod).toBe("math");
    // Missing fields are filled from DEFAULT_ALARM_DEFAULTS
    expect(resolved.alarmDefaults.gradualVolumeDurationSec).toBe(
      DEFAULT_ALARM_DEFAULTS.gradualVolumeDurationSec,
    );
    expect(resolved.alarmDefaults.snoozeDurationMin).toBe(
      DEFAULT_ALARM_DEFAULTS.snoozeDurationMin,
    );
    expect(resolved.alarmDefaults.snoozeMaxCount).toBe(
      DEFAULT_ALARM_DEFAULTS.snoozeMaxCount,
    );
    expect(resolved.alarmDefaults.vibrationEnabled).toBe(
      DEFAULT_ALARM_DEFAULTS.vibrationEnabled,
    );
    expect(resolved.alarmDefaults.volumeButtonBehavior).toBe(
      DEFAULT_ALARM_DEFAULTS.volumeButtonBehavior,
    );
    expect(resolved.alarmDefaults.mathDifficulty).toBe(
      DEFAULT_ALARM_DEFAULTS.mathDifficulty,
    );
  });

  it("fills missing mathDifficulty from DEFAULT_ALARM_DEFAULTS when old settings loaded", () => {
    const store = createStore();
    // Simulate settings from an older version that lacked mathDifficulty
    const oldAlarmDefaults = {
      dismissalMethod: "shake" as const,
      gradualVolumeDurationSec: 60,
      snoozeDurationMin: 10,
      snoozeMaxCount: 5,
      vibrationEnabled: false,
      volumeButtonBehavior: "dismiss" as const,
      // mathDifficulty is missing (old version)
    };
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      alarmDefaults: oldAlarmDefaults as AlarmDefaults,
    });
    const resolved = store.get(resolvedSettingsAtom);
    // Old values are preserved
    expect(resolved.alarmDefaults.dismissalMethod).toBe("shake");
    expect(resolved.alarmDefaults.gradualVolumeDurationSec).toBe(60);
    expect(resolved.alarmDefaults.snoozeDurationMin).toBe(10);
    expect(resolved.alarmDefaults.snoozeMaxCount).toBe(5);
    expect(resolved.alarmDefaults.vibrationEnabled).toBe(false);
    expect(resolved.alarmDefaults.volumeButtonBehavior).toBe("dismiss");
    // mathDifficulty filled from default (1)
    expect(resolved.alarmDefaults.mathDifficulty).toBe(1);
  });

  it("preserves stored alarmDefaults values over defaults", () => {
    const store = createStore();
    const customAlarmDefaults: AlarmDefaults = {
      dismissalMethod: "math",
      gradualVolumeDurationSec: 120,
      snoozeDurationMin: 15,
      snoozeMaxCount: 1,
      vibrationEnabled: false,
      volumeButtonBehavior: "dismiss",
      mathDifficulty: 3,
    };
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      alarmDefaults: customAlarmDefaults,
    });
    const resolved = store.get(resolvedSettingsAtom);
    expect(resolved.alarmDefaults).toEqual(customAlarmDefaults);
  });

  it("deep-merges widgetSettings is NOT done (only alarmDefaults)", () => {
    const store = createStore();
    // Simulate stored settings with a partial widgetSettings object.
    // Since resolvedSettingsAtom only deep-merges alarmDefaults,
    // widgetSettings uses shallow spread: stored replaces defaults entirely.
    const partialWidget = {
      backgroundColor: "#FF0000",
      textColor: "#00FF00",
      // Missing: secondaryTextColor, accentColor, opacity, borderRadius,
      //          showRealTime, showNextAlarm
    };
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      widgetSettings: partialWidget as AppSettings["widgetSettings"],
    });
    const resolved = store.get(resolvedSettingsAtom);
    // The stored partial object replaces the entire widgetSettings
    expect(resolved.widgetSettings.backgroundColor).toBe("#FF0000");
    expect(resolved.widgetSettings.textColor).toBe("#00FF00");
    // Missing fields are NOT filled from DEFAULT_WIDGET_SETTINGS
    expect(resolved.widgetSettings.secondaryTextColor).toBeUndefined();
    expect(resolved.widgetSettings.opacity).toBeUndefined();
    expect(resolved.widgetSettings.borderRadius).toBeUndefined();
    expect(resolved.widgetSettings.showRealTime).toBeUndefined();
    expect(resolved.widgetSettings.showNextAlarm).toBeUndefined();
  });
});
