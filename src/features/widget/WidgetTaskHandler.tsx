import React from "react";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { ClockWidget } from "./ClockWidget";
import type { WidgetSize } from "./ClockWidget";
import { loadSettings, loadAlarms } from "./services/widgetData";
import { DEFAULT_WIDGET_SETTINGS } from "../../models/Settings";

const WIDGET_NAMES: Record<string, WidgetSize> = {
  ClockWidgetSmallProvider: "small",
  ClockWidgetProvider: "medium",
  ClockWidgetLargeProvider: "large",
};

export function registerClockWidgetHandler() {
  registerWidgetTaskHandler(async (props) => {
    const widgetSize = WIDGET_NAMES[props.widgetInfo.widgetName];
    if (!widgetSize) {
      return;
    }

    switch (props.widgetAction) {
      case "WIDGET_ADDED":
      case "WIDGET_UPDATE":
      case "WIDGET_RESIZED": {
        const settings = await loadSettings();
        const alarms = await loadAlarms();
        const nowMs = Date.now();
        const widgetSettings =
          settings.widgetSettings ?? DEFAULT_WIDGET_SETTINGS;

        props.renderWidget(
          <ClockWidget
            cycleConfig={settings.cycleConfig}
            alarms={alarms}
            nowMs={nowMs}
            widgetSettings={widgetSettings}
            widgetSize={widgetSize}
          />,
        );
        break;
      }
      case "WIDGET_DELETED":
        break;
      case "WIDGET_CLICK":
        break;
    }
  });
}
