import AsyncStorage from "@react-native-async-storage/async-storage";

import { resolveSettings } from "../../../src/core/storage/appState";
import { STORAGE_KEYS } from "../../../src/core/storage/keys";
import {
  readStoredAlarms,
  readStoredSettings,
} from "../../../src/core/storage/storedAppState";
import type { Alarm } from "../../../src/models/Alarm";
import {
  DEFAULT_ALARM_DEFAULTS,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;

function makeAlarm(): Alarm {
  return {
    id: "alarm-1",
    label: "Morning",
    enabled: true,
    targetTimestampMs: 1_700_000_000_000,
    setInTimeSystem: "custom",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 10,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveSettings", () => {
  it("fills every missing nested setting from its defaults", () => {
    const resolved = resolveSettings({
      cycleConfig: { cycleLengthMinutes: 1_500 },
      alarmDefaults: { dismissalMethod: "math" },
      widgetSettings: {
        backgroundColor: "#000000",
        showNextAlarm: false,
      },
    });

    expect(resolved.cycleConfig).toEqual({
      cycleLengthMinutes: 1_500,
      baseTimeMs: DEFAULT_SETTINGS.cycleConfig.baseTimeMs,
    });
    expect(resolved.alarmDefaults).toEqual({
      ...DEFAULT_ALARM_DEFAULTS,
      dismissalMethod: "math",
    });
    expect(resolved.widgetSettings).toEqual({
      ...DEFAULT_WIDGET_SETTINGS,
      backgroundColor: "#000000",
      showNextAlarm: false,
    });
  });

  it("uses defaults when the stored value is not an object", () => {
    expect(resolveSettings(["invalid"])).toEqual(DEFAULT_SETTINGS);
  });

  it("uses defaults when a persisted field has an invalid type", () => {
    expect(
      resolveSettings({
        cycleConfig: { cycleLengthMinutes: "invalid" },
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });
});

describe("readStoredSettings", () => {
  it("normalizes partial persisted settings", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ widgetSettings: { accentColor: "#FFFFFF" } }),
    );

    await expect(readStoredSettings()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      widgetSettings: {
        ...DEFAULT_WIDGET_SETTINGS,
        accentColor: "#FFFFFF",
      },
    });
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEYS.SETTINGS);
  });

  it("uses defaults when persisted settings cannot be parsed", async () => {
    mockGetItem.mockResolvedValue("invalid json");

    await expect(readStoredSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe("readStoredAlarms", () => {
  it("normalizes a valid persisted alarm array", async () => {
    const alarms = [makeAlarm()];
    mockGetItem.mockResolvedValue(JSON.stringify(alarms));

    await expect(readStoredAlarms()).resolves.toEqual([
      expect.objectContaining(alarms[0]),
    ]);
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEYS.ALARMS);
  });

  it("returns null for missing, malformed, or non-array storage", async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await expect(readStoredAlarms()).resolves.toBeNull();

    mockGetItem.mockResolvedValueOnce("invalid json");
    await expect(readStoredAlarms()).resolves.toBeNull();

    mockGetItem.mockResolvedValueOnce(JSON.stringify({ id: "not-an-array" }));
    await expect(readStoredAlarms()).resolves.toBeNull();
  });

  it("returns null when an alarm record is invalid", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([null, { id: 1 }]));

    await expect(readStoredAlarms()).resolves.toBeNull();
  });
});
