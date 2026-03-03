import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { spacing } from "../../../app/spacing";
import type { SleepSession } from "../../../models/SleepSession";

const CHART_HEIGHT = 200;
const PADDING_LEFT = 48;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 24;
const DOT_RADIUS = 4;
const MINUTES_IN_DAY = 24 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const Y_LABELS = [
  { label: "0:00", minutes: 0 },
  { label: "6:00", minutes: 360 },
  { label: "12:00", minutes: 720 },
  { label: "18:00", minutes: 1080 },
  { label: "24:00", minutes: 1440 },
];

interface SleepDriftChartProps {
  sessions: SleepSession[];
}

export function SleepDriftChart({ sessions }: SleepDriftChartProps) {
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 32;
  const plotWidth = chartWidth - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const dataPoints = useMemo(() => {
    if (sessions.length === 0) return [];

    const sorted = [...sessions].sort(
      (a, b) => a.startTimestampMs - b.startTimestampMs,
    );
    const firstDay = startOfDay(sorted[0].startTimestampMs);

    return sorted.map((session) => {
      const dayOffset =
        (startOfDay(session.startTimestampMs) - firstDay) / MS_PER_DAY;
      const d = new Date(session.startTimestampMs);
      const minuteOfDay = d.getHours() * 60 + d.getMinutes();
      return { dayOffset, minuteOfDay };
    });
  }, [sessions]);

  if (dataPoints.length === 0) {
    return null;
  }

  const maxDay = Math.max(...dataPoints.map((p) => p.dayOffset), 1);

  const toX = (day: number) => PADDING_LEFT + (day / maxDay) * plotWidth;
  const toY = (minutes: number) =>
    PADDING_TOP + (minutes / MINUTES_IN_DAY) * plotHeight;

  return (
    <View style={styles.container} testID="sleep-drift-chart">
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {/* Y-axis gridlines and labels */}
        {Y_LABELS.map(({ label, minutes }) => (
          <React.Fragment key={label}>
            <Line
              x1={PADDING_LEFT}
              y1={toY(minutes)}
              x2={chartWidth - PADDING_RIGHT}
              y2={toY(minutes)}
              stroke={theme.colors.outlineVariant}
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
            <SvgText
              x={PADDING_LEFT - 8}
              y={toY(minutes)}
              fill={theme.colors.onSurfaceVariant}
              fontSize={10}
              textAnchor="end"
              alignmentBaseline="central"
            >
              {label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-axis baseline */}
        <Line
          x1={PADDING_LEFT}
          y1={CHART_HEIGHT - PADDING_BOTTOM}
          x2={chartWidth - PADDING_RIGHT}
          y2={CHART_HEIGHT - PADDING_BOTTOM}
          stroke={theme.colors.outline}
          strokeWidth={1}
        />

        {/* Y-axis */}
        <Line
          x1={PADDING_LEFT}
          y1={PADDING_TOP}
          x2={PADDING_LEFT}
          y2={CHART_HEIGHT - PADDING_BOTTOM}
          stroke={theme.colors.outline}
          strokeWidth={1}
        />

        {/* Data points */}
        {dataPoints.map((point, i) => (
          <Circle
            key={i}
            cx={toX(point.dayOffset)}
            cy={toY(point.minuteOfDay)}
            r={DOT_RADIUS}
            fill={theme.colors.primary}
            opacity={0.8}
          />
        ))}
      </Svg>
    </View>
  );
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
});
