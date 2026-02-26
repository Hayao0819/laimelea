import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Line, G, Text as SvgText } from "react-native-svg";
import { useTheme } from "react-native-paper";
import type { CustomTimeValue } from "../../../models/CustomTime";

interface Props {
  customTime: CustomTimeValue;
  cycleLengthMinutes: number;
  size?: number;
}

export function AnalogClock({
  customTime,
  cycleLengthMinutes,
  size = 280,
}: Props) {
  const theme = useTheme();
  const totalHours = cycleLengthMinutes / 60;
  // One revolution = half cycle (e.g., 13h for 26h cycle, like 12h on a 24h clock)
  const hoursPerRevolution = totalHours / 2;
  const center = size / 2;
  const radius = center - 10;

  const markers = useMemo(() => {
    const count = Math.ceil(hoursPerRevolution);
    const result = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / hoursPerRevolution) * 360 - 90;
      const rad = (angle * Math.PI) / 180;
      const isEven = i % 2 === 0;
      const innerR = isEven ? radius - 20 : radius - 12;
      const outerR = radius - 4;
      result.push({
        i,
        x1: center + innerR * Math.cos(rad),
        y1: center + innerR * Math.sin(rad),
        x2: center + outerR * Math.cos(rad),
        y2: center + outerR * Math.sin(rad),
        labelX: center + (radius - 32) * Math.cos(rad),
        labelY: center + (radius - 32) * Math.sin(rad),
        isEven,
      });
    }
    return result;
  }, [hoursPerRevolution, center, radius]);

  // Hour hand wraps around at half-cycle (2 revolutions per full cycle)
  const wrappedHours =
    (customTime.hours + customTime.minutes / 60) % hoursPerRevolution;
  const hourAngle = (wrappedHours / hoursPerRevolution) * 360 - 90;
  const minuteAngle =
    ((customTime.minutes + customTime.seconds / 60) / 60) * 360 - 90;
  const secondAngle = (customTime.seconds / 60) * 360 - 90;

  const hourRad = (hourAngle * Math.PI) / 180;
  const minuteRad = (minuteAngle * Math.PI) / 180;
  const secondRad = (secondAngle * Math.PI) / 180;

  const hourLen = radius * 0.5;
  const minuteLen = radius * 0.7;
  const secondLen = radius * 0.8;

  return (
    <View style={styles.container} testID="analog-clock">
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill={theme.colors.surfaceVariant}
          stroke={theme.colors.outline}
          strokeWidth={2}
        />

        {markers.map((m) => (
          <G key={m.i}>
            <Line
              x1={m.x1}
              y1={m.y1}
              x2={m.x2}
              y2={m.y2}
              stroke={theme.colors.onSurface}
              strokeWidth={m.isEven ? 2 : 1}
            />
            {m.isEven && (
              <SvgText
                x={m.labelX}
                y={m.labelY}
                fill={theme.colors.onSurface}
                fontSize={12}
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {m.i}
              </SvgText>
            )}
          </G>
        ))}

        {/* Hour hand */}
        <Line
          x1={center}
          y1={center}
          x2={center + hourLen * Math.cos(hourRad)}
          y2={center + hourLen * Math.sin(hourRad)}
          stroke={theme.colors.onSurface}
          strokeWidth={4}
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <Line
          x1={center}
          y1={center}
          x2={center + minuteLen * Math.cos(minuteRad)}
          y2={center + minuteLen * Math.sin(minuteRad)}
          stroke={theme.colors.onSurface}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Second hand */}
        <Line
          x1={center}
          y1={center}
          x2={center + secondLen * Math.cos(secondRad)}
          y2={center + secondLen * Math.sin(secondRad)}
          stroke={theme.colors.primary}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <Circle cx={center} cy={center} r={4} fill={theme.colors.primary} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
});
