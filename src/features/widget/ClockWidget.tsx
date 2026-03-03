import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";

import { realToCustom } from "../../core/time/conversions";
import {
  formatCustomDay,
  formatCustomTimeShort,
} from "../../core/time/formatting";
import type { Alarm } from "../../models/Alarm";
import type { CustomTimeValue, CycleConfig } from "../../models/CustomTime";
import type { WidgetSettings } from "../../models/Settings";
import { DEFAULT_WIDGET_SETTINGS } from "../../models/Settings";

export type WidgetSize = "small" | "medium" | "large";

export interface ClockWidgetData {
  cycleConfig: CycleConfig;
  alarms: Alarm[];
  nowMs: number;
  widgetSettings?: WidgetSettings;
  widgetSize?: WidgetSize;
}

function applyOpacity(hexColor: string, opacity: number): ColorProp {
  const clamped = Math.max(0, Math.min(100, opacity));
  const alpha = Math.round((clamped / 100) * 255);
  const alphaHex = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `${hexColor}${alphaHex}` as ColorProp;
}

function toColor(hex: string): ColorProp {
  return hex as ColorProp;
}

const SIZE_CONFIG = {
  small: {
    customTimeFontSize: 28,
    dayFontSize: 12,
    realTimeFontSize: 10,
    alarmFontSize: 10,
    padding: 8,
  },
  medium: {
    customTimeFontSize: 36,
    dayFontSize: 14,
    realTimeFontSize: 12,
    alarmFontSize: 12,
    padding: 12,
  },
  large: {
    customTimeFontSize: 48,
    dayFontSize: 18,
    realTimeFontSize: 16,
    alarmFontSize: 16,
    padding: 20,
  },
} as const;

function formatRealTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getNextAlarm(alarms: Alarm[], nowMs: number): Alarm | undefined {
  return alarms
    .filter((a) => a.enabled && a.targetTimestampMs > nowMs)
    .sort((a, b) => a.targetTimestampMs - b.targetTimestampMs)[0];
}

function formatNextAlarmText(alarm: Alarm, cycleConfig: CycleConfig): string {
  const customTime: CustomTimeValue = realToCustom(
    alarm.targetTimestampMs,
    cycleConfig,
  );
  const time = formatCustomTimeShort(customTime);
  const label = alarm.label ? ` ${alarm.label}` : "";
  return `\u23F0 ${time}${label}`;
}

export function ClockWidget({
  cycleConfig,
  alarms,
  nowMs,
  widgetSettings,
  widgetSize = "medium",
}: ClockWidgetData) {
  const ws = widgetSettings ?? DEFAULT_WIDGET_SETTINGS;
  const sizeConfig = SIZE_CONFIG[widgetSize];

  const customTime = realToCustom(nowMs, cycleConfig);
  const customTimeStr = formatCustomTimeShort(customTime);
  const dayStr = formatCustomDay(customTime);
  const realTimeStr = formatRealTime(nowMs);
  const nextAlarm = getNextAlarm(alarms, nowMs);

  const showDay = widgetSize !== "small";
  const showRealTime = widgetSize !== "small" && ws.showRealTime;
  const showNextAlarm = widgetSize !== "small" && ws.showNextAlarm;

  const containerStyle = {
    height: "match_parent" as const,
    width: "match_parent" as const,
    flexDirection: "column" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: applyOpacity(ws.backgroundColor, ws.opacity),
    borderRadius: ws.borderRadius,
    padding: sizeConfig.padding,
  };
  const timeStyle = {
    fontSize: sizeConfig.customTimeFontSize,
    fontWeight: "bold" as const,
    color: toColor(ws.textColor),
  };
  const dayStyle = {
    fontSize: sizeConfig.dayFontSize,
    color: toColor(ws.secondaryTextColor),
    marginTop: 2,
  };
  const realTimeStyle = {
    fontSize: sizeConfig.realTimeFontSize,
    color: toColor(ws.secondaryTextColor),
    marginTop: 4,
  };
  const alarmStyle = {
    fontSize: sizeConfig.alarmFontSize,
    color: toColor(ws.accentColor),
    marginTop: 6,
  };

  return (
    <FlexWidget style={containerStyle} clickAction="OPEN_APP">
      <TextWidget text={customTimeStr} style={timeStyle} />
      {showDay ? <TextWidget text={dayStr} style={dayStyle} /> : null}
      {showRealTime ? (
        <TextWidget text={realTimeStr} style={realTimeStyle} />
      ) : null}
      {showNextAlarm && nextAlarm ? (
        <TextWidget
          text={formatNextAlarmText(nextAlarm, cycleConfig)}
          style={alarmStyle}
          maxLines={1}
          truncate="END"
        />
      ) : null}
    </FlexWidget>
  );
}
