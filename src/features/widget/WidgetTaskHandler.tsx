import React from "react";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { ClockWidget } from "./ClockWidget";
import { loadSettings, loadAlarms } from "./services/widgetData";

const WIDGET_NAME = "ClockWidgetProvider";

export function registerClockWidgetHandler() {
  registerWidgetTaskHandler(async (props) => {
    if (props.widgetInfo.widgetName !== WIDGET_NAME) {
      return;
    }

    switch (props.widgetAction) {
      case "WIDGET_ADDED":
      case "WIDGET_UPDATE":
      case "WIDGET_RESIZED": {
        const settings = await loadSettings();
        const alarms = await loadAlarms();
        const nowMs = Date.now();

        props.renderWidget(
          <ClockWidget
            cycleConfig={settings.cycleConfig}
            alarms={alarms}
            nowMs={nowMs}
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
