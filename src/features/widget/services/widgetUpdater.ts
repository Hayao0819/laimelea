import React from "react";
import { requestWidgetUpdate } from "react-native-android-widget";

import { DEFAULT_WIDGET_SETTINGS } from "../../../models/Settings";
import type { WidgetSize } from "../ClockWidget";
import { ClockWidget } from "../ClockWidget";
import { loadAlarms,loadSettings } from "./widgetData";

const WIDGET_PROVIDERS: { name: string; size: WidgetSize }[] = [
  { name: "ClockWidgetSmallProvider", size: "small" },
  { name: "ClockWidgetProvider", size: "medium" },
  { name: "ClockWidgetLargeProvider", size: "large" },
];

export async function requestClockWidgetUpdate(): Promise<void> {
  try {
    const settings = await loadSettings();
    const alarms = await loadAlarms();
    const nowMs = Date.now();
    const widgetSettings = settings.widgetSettings ?? DEFAULT_WIDGET_SETTINGS;

    await Promise.all(
      WIDGET_PROVIDERS.map(({ name, size }) =>
        requestWidgetUpdate({
          widgetName: name,
          renderWidget: () =>
            React.createElement(ClockWidget, {
              cycleConfig: settings.cycleConfig,
              alarms,
              nowMs,
              widgetSettings,
              widgetSize: size,
            }),
        }).catch(() => {
          // Widget not placed — ignore
        }),
      ),
    );
  } catch {
    // Native module unavailable — ignore
  }
}
