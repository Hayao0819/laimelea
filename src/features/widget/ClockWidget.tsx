import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { CycleConfig, CustomTimeValue } from "../../models/CustomTime";
import type { Alarm } from "../../models/Alarm";
import { realToCustom } from "../../core/time/conversions";
import {
  formatCustomTimeShort,
  formatCustomDay,
} from "../../core/time/formatting";

interface ClockWidgetData {
  cycleConfig: CycleConfig;
  alarms: Alarm[];
  nowMs: number;
}

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

const widgetStyles = {
  container: {
    height: "match_parent",
    width: "match_parent",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1B1F",
    borderRadius: 16,
    padding: 12,
  },
  customTime: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#E6E1E5",
  },
  day: {
    fontSize: 14,
    color: "#CAC4D0",
    marginTop: 2,
  },
  realTime: {
    fontSize: 12,
    color: "#938F99",
    marginTop: 4,
  },
  alarm: {
    fontSize: 12,
    color: "#D0BCFF",
    marginTop: 6,
  },
} as const;

export function ClockWidget({ cycleConfig, alarms, nowMs }: ClockWidgetData) {
  const customTime = realToCustom(nowMs, cycleConfig);
  const customTimeStr = formatCustomTimeShort(customTime);
  const dayStr = formatCustomDay(customTime);
  const realTimeStr = formatRealTime(nowMs);
  const nextAlarm = getNextAlarm(alarms, nowMs);

  return (
    <FlexWidget style={widgetStyles.container} clickAction="OPEN_APP">
      <TextWidget text={customTimeStr} style={widgetStyles.customTime} />
      <TextWidget text={dayStr} style={widgetStyles.day} />
      <TextWidget text={realTimeStr} style={widgetStyles.realTime} />
      {nextAlarm ? (
        <TextWidget
          text={formatNextAlarmText(nextAlarm, cycleConfig)}
          style={widgetStyles.alarm}
          maxLines={1}
          truncate="END"
        />
      ) : null}
    </FlexWidget>
  );
}
