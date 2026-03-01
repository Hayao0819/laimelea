import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../../src/core/storage/keys";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";
import {
  loadSettings,
  loadAlarms,
} from "../../../../src/features/widget/services/widgetData";
import type { Alarm } from "../../../../src/models/Alarm";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("loadSettings", () => {
  it("returns parsed settings merged with defaults when AsyncStorage has data", async () => {
    const stored = { theme: "dark", timeFormat: "12h" };
    mockGetItem.mockResolvedValue(JSON.stringify(stored));

    const result = await loadSettings();

    expect(result).toEqual({ ...DEFAULT_SETTINGS, ...stored });
  });

  it("returns DEFAULT_SETTINGS when AsyncStorage returns null", async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await loadSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("returns DEFAULT_SETTINGS when JSON.parse throws", async () => {
    mockGetItem.mockResolvedValue("{invalid json");

    const result = await loadSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("returns DEFAULT_SETTINGS when AsyncStorage.getItem rejects", async () => {
    mockGetItem.mockRejectedValue(new Error("Storage error"));

    const result = await loadSettings();

    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("reads from the correct storage key (STORAGE_KEYS.SETTINGS)", async () => {
    mockGetItem.mockResolvedValue(null);

    await loadSettings();

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEYS.SETTINGS);
  });
});

describe("loadAlarms", () => {
  const sampleAlarms: Alarm[] = [
    {
      id: "alarm-1",
      label: "Morning",
      enabled: true,
      targetTimestampMs: 1700000000000,
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
      lastFiredAt: null,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ];

  it("returns parsed alarms when AsyncStorage has data", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(sampleAlarms));

    const result = await loadAlarms();

    expect(result).toEqual(sampleAlarms);
  });

  it("returns empty array when AsyncStorage returns null", async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await loadAlarms();

    expect(result).toEqual([]);
  });

  it("returns empty array when JSON.parse throws", async () => {
    mockGetItem.mockResolvedValue("not valid json[{");

    const result = await loadAlarms();

    expect(result).toEqual([]);
  });

  it("returns empty array when AsyncStorage.getItem rejects", async () => {
    mockGetItem.mockRejectedValue(new Error("Storage unavailable"));

    const result = await loadAlarms();

    expect(result).toEqual([]);
  });

  it("reads from the correct storage key (STORAGE_KEYS.ALARMS)", async () => {
    mockGetItem.mockResolvedValue(null);

    await loadAlarms();

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEYS.ALARMS);
  });
});
