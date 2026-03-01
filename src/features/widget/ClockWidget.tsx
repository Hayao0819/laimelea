import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { CycleConfig, CustomTimeValue } from "../../models/CustomTime";
import type { Alarm } from "../../models/Alarm";
import type { WidgetSettings } from "../../models/Settings";
import { DEFAULT_WIDGET_SETTINGS } from "../../models/Settings";
import { realToCustom } from "../../core/time/conversions";
import {
  formatCustomTimeShort,
  formatCustomDay,
} from "../../core/time/formatting";

export type WidgetSize = "small" | "medium" | "large";

export interface ClockWidgetData {
  cycleConfig: CycleConfig;
  alarms: Alarm[];
  nowMs: number;
  widgetSettings?: WidgetSettings;
  widgetSize?: WidgetSize;
}

function applyOpacity(hexColor: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(100, opacity));
  const alpha = Math.round((clamped / 100) * 255);
  const alphaHex = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `${hexColor}${alphaHex}`;
}

const SIZE_CONFIG = {
  small: { customTimeFontSize: 28, dayFontSize: 12, realTimeFontSize: 10, alarmFontSize: 10, padding: 8 },
  medium: { customTimeFontSize: 36, dayFontSize: 14, realTimeFontSize: 12, alarmFontSize: 12, padding: 12 },
  large: { customTimeFontSize: 48, dayFontSize: 18, realTimeFontSize: 16, alarmFontSize: 16, padding: 20 },
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

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: applyOpacity(ws.backgroundColor, ws.opacity),
        borderRadius: ws.borderRadius,
        padding: sizeConfig.padding,
      }}
      clickAction="OPEN_APP"
    >
      <TextWidget
        text={customTimeStr}
        style={{
          fontSize: sizeConfig.customTimeFontSize,
          fontWeight: "bold",
          color: ws.textColor,
        }}
      />
      {showDay ? (
        <TextWidget
          text={dayStr}
          style={{
            fontSize: sizeConfig.dayFontSize,
            color: ws.secondaryTextColor,
            marginTop: 2,
          }}
        />
      ) : null}
      {showRealTime ? (
        <TextWidget
          text={realTimeStr}
          style={{
            fontSize: sizeConfig.realTimeFontSize,
            color: ws.secondaryTextColor,
            marginTop: 4,
          }}
        />
      ) : null}
      {showNextAlarm && nextAlarm ? (
        <TextWidget
          text={formatNextAlarmText(nextAlarm, cycleConfig)}
          style={{
            fontSize: sizeConfig.alarmFontSize,
            color: ws.accentColor,
            marginTop: 6,
          }}
          maxLines={1}
          truncate="END"
        />
      ) : null}
    </FlexWidget>
  );
}
