import { registerWidgetTaskHandler } from "react-native-android-widget";
import {
  loadSettings,
  loadAlarms,
} from "../../../src/features/widget/services/widgetData";
import { registerClockWidgetHandler } from "../../../src/features/widget/WidgetTaskHandler";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../src/models/Settings";
import type { AppSettings } from "../../../src/models/Settings";
import type { Alarm } from "../../../src/models/Alarm";

jest.mock("react-native-android-widget", () => ({
  registerWidgetTaskHandler: jest.fn(),
  FlexWidget: "FlexWidget",
  TextWidget: "TextWidget",
}));

jest.mock("../../../src/features/widget/services/widgetData", () => ({
  loadSettings: jest.fn(),
  loadAlarms: jest.fn(),
}));

const mockLoadSettings = loadSettings as jest.Mock;
const mockLoadAlarms = loadAlarms as jest.Mock;

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "",
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
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function getTaskHandler() {
  (registerWidgetTaskHandler as jest.Mock).mockClear();
  registerClockWidgetHandler();
  const mock = registerWidgetTaskHandler as jest.Mock;
  expect(mock).toHaveBeenCalledTimes(1);
  return mock.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockLoadAlarms.mockResolvedValue([]);
});

describe("registerClockWidgetHandler", () => {
  it("calls registerWidgetTaskHandler with a callback", () => {
    registerClockWidgetHandler();
    expect(registerWidgetTaskHandler).toHaveBeenCalledTimes(1);
    expect(registerWidgetTaskHandler).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });
});

describe("widget task handler callback", () => {
  describe("known widget names", () => {
    it('renders ClockWidget for ClockWidgetSmallProvider with widgetSize="small"', async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetSmallProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      expect(renderWidget).toHaveBeenCalledTimes(1);
      const element = renderWidget.mock.calls[0][0];
      expect(element.props.widgetSize).toBe("small");
    });

    it('renders ClockWidget for ClockWidgetProvider with widgetSize="medium"', async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      expect(renderWidget).toHaveBeenCalledTimes(1);
      const element = renderWidget.mock.calls[0][0];
      expect(element.props.widgetSize).toBe("medium");
    });

    it('renders ClockWidget for ClockWidgetLargeProvider with widgetSize="large"', async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetLargeProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      expect(renderWidget).toHaveBeenCalledTimes(1);
      const element = renderWidget.mock.calls[0][0];
      expect(element.props.widgetSize).toBe("large");
    });
  });

  describe("widget actions", () => {
    it("renders widget on WIDGET_ADDED action", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_ADDED",
        renderWidget,
      });

      expect(renderWidget).toHaveBeenCalledTimes(1);
    });

    it("renders widget on WIDGET_UPDATE action", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      expect(renderWidget).toHaveBeenCalledTimes(1);
    });

    it("renders widget on WIDGET_RESIZED action", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_RESIZED",
        renderWidget,
      });

      expect(renderWidget).toHaveBeenCalledTimes(1);
    });

    it("does not render widget on WIDGET_DELETED action", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_DELETED",
        renderWidget,
      });

      expect(renderWidget).not.toHaveBeenCalled();
    });

    it("does not render widget on WIDGET_CLICK action", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_CLICK",
        renderWidget,
      });

      expect(renderWidget).not.toHaveBeenCalled();
    });
  });

  describe("unknown widget name", () => {
    it("returns early without calling renderWidget for unknown widget names", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "UnknownWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      expect(renderWidget).not.toHaveBeenCalled();
      expect(mockLoadSettings).not.toHaveBeenCalled();
      expect(mockLoadAlarms).not.toHaveBeenCalled();
    });
  });

  describe("data loading", () => {
    it("calls loadSettings and loadAlarms", async () => {
      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      expect(mockLoadSettings).toHaveBeenCalledTimes(1);
      expect(mockLoadAlarms).toHaveBeenCalledTimes(1);
    });

    it("passes cycleConfig from loaded settings to ClockWidget", async () => {
      const customCycleConfig = { cycleLengthMinutes: 1440, baseTimeMs: 1000 };
      const customSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        cycleConfig: customCycleConfig,
      };
      mockLoadSettings.mockResolvedValue(customSettings);

      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      const element = renderWidget.mock.calls[0][0];
      expect(element.props.cycleConfig).toEqual(customCycleConfig);
    });

    it("passes loaded alarms to ClockWidget", async () => {
      const alarms = [makeAlarm({ id: "a1" }), makeAlarm({ id: "a2" })];
      mockLoadAlarms.mockResolvedValue(alarms);

      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      const element = renderWidget.mock.calls[0][0];
      expect(element.props.alarms).toEqual(alarms);
    });

    it("falls back to DEFAULT_WIDGET_SETTINGS when settings.widgetSettings is undefined", async () => {
      const settingsWithoutWidget = {
        ...DEFAULT_SETTINGS,
        widgetSettings: undefined,
      };
      mockLoadSettings.mockResolvedValue(settingsWithoutWidget);

      const handler = getTaskHandler();
      const renderWidget = jest.fn();
      await handler({
        widgetInfo: { widgetName: "ClockWidgetProvider" },
        widgetAction: "WIDGET_UPDATE",
        renderWidget,
      });

      const element = renderWidget.mock.calls[0][0];
      expect(element.props.widgetSettings).toEqual(DEFAULT_WIDGET_SETTINGS);
    });
  });
});
