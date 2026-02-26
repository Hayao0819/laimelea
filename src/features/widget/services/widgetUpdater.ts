import React from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { ClockWidget } from "../ClockWidget";
import { loadSettings, loadAlarms } from "./widgetData";

const WIDGET_NAME = "ClockWidgetProvider";

export async function requestClockWidgetUpdate(): Promise<void> {
  try {
    const settings = await loadSettings();
    const alarms = await loadAlarms();
    const nowMs = Date.now();

    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () =>
        React.createElement(ClockWidget, {
          cycleConfig: settings.cycleConfig,
          alarms,
          nowMs,
        }),
    });
  } catch {
    // Widget not placed or native module unavailable — ignore
  }
}
