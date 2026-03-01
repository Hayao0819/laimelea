import { requestWidgetUpdate } from "react-native-android-widget";
import {
  loadSettings,
  loadAlarms,
} from "../../../../src/features/widget/services/widgetData";
import { DEFAULT_WIDGET_SETTINGS } from "../../../../src/models/Settings";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";
import { requestClockWidgetUpdate } from "../../../../src/features/widget/services/widgetUpdater";
import { ClockWidget } from "../../../../src/features/widget/ClockWidget";
import type { Alarm } from "../../../../src/models/Alarm";

jest.mock("../../../../src/features/widget/services/widgetData", () => ({
  loadSettings: jest.fn(),
  loadAlarms: jest.fn(),
}));

jest.mock("react-native-android-widget", () => ({
  requestWidgetUpdate: jest.fn(),
}));

const mockLoadSettings = loadSettings as jest.MockedFunction<
  typeof loadSettings
>;
const mockLoadAlarms = loadAlarms as jest.MockedFunction<typeof loadAlarms>;
const mockRequestWidgetUpdate = requestWidgetUpdate as jest.MockedFunction<
  typeof requestWidgetUpdate
>;

const sampleAlarms: Alarm[] = [
  {
    id: "alarm-1",
    label: "Test",
    enabled: true,
    targetTimestampMs: Date.now() + 3600_000,
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockLoadAlarms.mockResolvedValue(sampleAlarms);
  mockRequestWidgetUpdate.mockResolvedValue(undefined as any);
});

describe("requestClockWidgetUpdate", () => {
  it("calls requestWidgetUpdate for all 3 providers with correct widgetName and widgetSize", async () => {
    await requestClockWidgetUpdate();

    expect(mockRequestWidgetUpdate).toHaveBeenCalledTimes(3);

    const calls = mockRequestWidgetUpdate.mock.calls;
    const widgetNames = calls.map((c) => c[0].widgetName);
    expect(widgetNames).toEqual([
      "ClockWidgetSmallProvider",
      "ClockWidgetProvider",
      "ClockWidgetLargeProvider",
    ]);

    // Verify each renderWidget produces a ClockWidget element with correct widgetSize
    const expectedSizes = ["small", "medium", "large"];
    calls.forEach((call, i) => {
      const element = call[0].renderWidget();
      expect(element.type).toBe(ClockWidget);
      expect(element.props.widgetSize).toBe(expectedSizes[i]);
    });
  });

  it("passes cycleConfig, alarms, nowMs, and widgetSettings to each ClockWidget", async () => {
    const beforeMs = Date.now();
    await requestClockWidgetUpdate();
    const afterMs = Date.now();

    const calls = mockRequestWidgetUpdate.mock.calls;
    for (const call of calls) {
      const element = call[0].renderWidget();
      expect(element.props.cycleConfig).toEqual(DEFAULT_SETTINGS.cycleConfig);
      expect(element.props.alarms).toEqual(sampleAlarms);
      expect(element.props.nowMs).toBeGreaterThanOrEqual(beforeMs);
      expect(element.props.nowMs).toBeLessThanOrEqual(afterMs);
      expect(element.props.widgetSettings).toEqual(
        DEFAULT_SETTINGS.widgetSettings,
      );
    }
  });

  it("falls back to DEFAULT_WIDGET_SETTINGS when settings.widgetSettings is undefined", async () => {
    const settingsWithoutWidget = { ...DEFAULT_SETTINGS };
    // Simulate a legacy settings object that lacks widgetSettings
    delete (settingsWithoutWidget as any).widgetSettings;
    mockLoadSettings.mockResolvedValue(settingsWithoutWidget);

    await requestClockWidgetUpdate();

    const calls = mockRequestWidgetUpdate.mock.calls;
    for (const call of calls) {
      const element = call[0].renderWidget();
      expect(element.props.widgetSettings).toEqual(DEFAULT_WIDGET_SETTINGS);
    }
  });

  it("continues updating other providers when one requestWidgetUpdate rejects", async () => {
    mockRequestWidgetUpdate
      .mockRejectedValueOnce(new Error("Widget not placed"))
      .mockResolvedValueOnce(undefined as any)
      .mockResolvedValueOnce(undefined as any);

    await expect(requestClockWidgetUpdate()).resolves.toBeUndefined();

    expect(mockRequestWidgetUpdate).toHaveBeenCalledTimes(3);
  });

  it("does not throw when loadSettings rejects", async () => {
    mockLoadSettings.mockRejectedValue(new Error("Storage error"));

    await expect(requestClockWidgetUpdate()).resolves.toBeUndefined();
  });

  it("does not throw when loadAlarms rejects", async () => {
    mockLoadAlarms.mockRejectedValue(new Error("Storage error"));

    await expect(requestClockWidgetUpdate()).resolves.toBeUndefined();
  });
});
