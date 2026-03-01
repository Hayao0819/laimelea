import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Line, G, Path, Text as SvgText } from "react-native-svg";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import type { CustomTimeValue } from "../../../models/CustomTime";

// Proportions (relative to radius)
const FACE_INNER_TRACK_R = 0.88;
const CARDINAL_LABEL_R_FACTOR = 0.78;
const MINOR_LABEL_R_FACTOR = 0.85;

const HOUR_HAND_LENGTH = 0.52;
const HOUR_HAND_BASE_HALF = 3;
const HOUR_HAND_TIP_HALF = 0.8;

const MINUTE_HAND_LENGTH = 0.72;
const MINUTE_HAND_BASE_HALF = 2.5;
const MINUTE_HAND_TIP_HALF = 0.5;

const SECOND_HAND_LENGTH = 0.82;
const SECOND_HAND_WIDTH = 1;
const SECOND_TAIL_LENGTH = 0.15;
const SECOND_TAIL_WIDTH = 2.5;
const SECOND_TAIL_DOT_R = 3.5;

const CENTER_OUTER_R = 5;
const CENTER_INNER_R = 2.5;

const CARDINAL_FONT_SIZE = 14;
const MINOR_FONT_SIZE = 10;

const STANDARD_HOURS_PER_REVOLUTION = 12;
const STANDARD_CARDINAL_INDICES = new Set([0, 3, 6, 9]);

function taperedHandPath(
  cx: number,
  cy: number,
  length: number,
  baseHalf: number,
  tipHalf: number,
  angleRad: number,
): string {
  const perpX = -Math.sin(angleRad);
  const perpY = Math.cos(angleRad);
  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);

  const bx1 = cx + perpX * baseHalf;
  const by1 = cy + perpY * baseHalf;
  const bx2 = cx - perpX * baseHalf;
  const by2 = cy - perpY * baseHalf;
  const tx1 = cx + dirX * length + perpX * tipHalf;
  const ty1 = cy + dirY * length + perpY * tipHalf;
  const tx2 = cx + dirX * length - perpX * tipHalf;
  const ty2 = cy + dirY * length - perpY * tipHalf;

  return `M${bx1} ${by1} L${tx1} ${ty1} L${tx2} ${ty2} L${bx2} ${by2} Z`;
}

interface Props {
  customTime: CustomTimeValue;
  cycleLengthMinutes: number;
  mode: "custom" | "24h";
  realTimeMs: number;
  size?: number;
}

export function AnalogClock({
  customTime,
  cycleLengthMinutes,
  mode,
  realTimeMs,
  size = 280,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const totalHours = cycleLengthMinutes / 60;
  // One revolution = half cycle (e.g., 13h for 26h cycle, like 12h on a 24h clock)
  const customHoursPerRevolution = totalHours / 2;

  const hoursPerRevolution =
    mode === "24h" ? STANDARD_HOURS_PER_REVOLUTION : customHoursPerRevolution;

  const center = size / 2;
  const radius = center - 10;

  const cardinalIndices = useMemo(() => {
    if (mode === "24h") return STANDARD_CARDINAL_INDICES;
    const count = Math.ceil(customHoursPerRevolution);
    const indices = new Set<number>();
    for (let q = 0; q < 4; q++) {
      const ideal = (q / 4) * customHoursPerRevolution;
      const idx = Math.round(ideal) % count;
      indices.add(idx);
    }
    return indices;
  }, [mode, customHoursPerRevolution]);

  const markerCount = Math.ceil(hoursPerRevolution);

  const markers = useMemo(() => {
    const result = [];
    for (let i = 0; i < markerCount; i++) {
      const angle = (i / hoursPerRevolution) * 360 - 90;
      const rad = (angle * Math.PI) / 180;
      const isCardinal = cardinalIndices.has(i);
      const rFactor = isCardinal
        ? CARDINAL_LABEL_R_FACTOR
        : MINOR_LABEL_R_FACTOR;
      result.push({
        i,
        isCardinal,
        labelX: center + radius * rFactor * Math.cos(rad),
        labelY: center + radius * rFactor * Math.sin(rad),
      });
    }
    return result;
  }, [hoursPerRevolution, markerCount, center, radius, cardinalIndices]);

  let hourAngle: number;
  let minuteAngle: number;
  let secondAngle: number;

  if (mode === "24h") {
    const date = new Date(realTimeMs);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    hourAngle = (((hours % 12) + minutes / 60) / 12) * 360 - 90;
    minuteAngle = ((minutes + seconds / 60) / 60) * 360 - 90;
    secondAngle = (seconds / 60) * 360 - 90;
  } else {
    // Hour hand wraps around at half-cycle (2 revolutions per full cycle)
    const wrappedHours =
      (customTime.hours + customTime.minutes / 60) % hoursPerRevolution;
    hourAngle = (wrappedHours / hoursPerRevolution) * 360 - 90;
    minuteAngle =
      ((customTime.minutes + customTime.seconds / 60) / 60) * 360 - 90;
    secondAngle = (customTime.seconds / 60) * 360 - 90;
  }

  const hourRad = (hourAngle * Math.PI) / 180;
  const minuteRad = (minuteAngle * Math.PI) / 180;
  const secondRad = (secondAngle * Math.PI) / 180;

  const hourLen = radius * HOUR_HAND_LENGTH;
  const minuteLen = radius * MINUTE_HAND_LENGTH;
  const secondLen = radius * SECOND_HAND_LENGTH;
  const tailLen = radius * SECOND_TAIL_LENGTH;

  return (
    <View
      style={styles.container}
      testID="analog-clock"
      accessibilityRole="image"
      accessibilityLabel={t("clock.analogClock")}
    >
      <Svg width={size} height={size}>
        {/* Clock face */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill={theme.colors.elevation.level1 ?? theme.colors.surfaceVariant}
          stroke={theme.colors.outlineVariant}
          strokeWidth={1}
        />

        {/* Inner track ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius * FACE_INNER_TRACK_R}
          fill="none"
          stroke={theme.colors.outlineVariant}
          strokeWidth={0.5}
          opacity={0.5}
        />

        {/* Markers */}
        {markers.map((m) => (
          <G key={m.i}>
            <SvgText
              x={m.labelX}
              y={m.labelY}
              fill={
                m.isCardinal
                  ? theme.colors.onSurface
                  : theme.colors.onSurfaceVariant
              }
              fontSize={m.isCardinal ? CARDINAL_FONT_SIZE : MINOR_FONT_SIZE}
              fontWeight={m.isCardinal ? "500" : "400"}
              opacity={m.isCardinal ? 1 : 0.6}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {m.i}
            </SvgText>
          </G>
        ))}

        {/* Hour hand (tapered) */}
        <Path
          d={taperedHandPath(
            center,
            center,
            hourLen,
            HOUR_HAND_BASE_HALF,
            HOUR_HAND_TIP_HALF,
            hourRad,
          )}
          fill={theme.colors.onSurface}
        />

        {/* Minute hand (tapered) */}
        <Path
          d={taperedHandPath(
            center,
            center,
            minuteLen,
            MINUTE_HAND_BASE_HALF,
            MINUTE_HAND_TIP_HALF,
            minuteRad,
          )}
          fill={theme.colors.onSurface}
        />

        {/* Second hand tail (counterweight) */}
        <Line
          x1={center}
          y1={center}
          x2={center - tailLen * Math.cos(secondRad)}
          y2={center - tailLen * Math.sin(secondRad)}
          stroke={theme.colors.primary}
          strokeWidth={SECOND_TAIL_WIDTH}
          strokeLinecap="round"
        />
        <Circle
          cx={center - tailLen * Math.cos(secondRad)}
          cy={center - tailLen * Math.sin(secondRad)}
          r={SECOND_TAIL_DOT_R}
          fill={theme.colors.primary}
        />

        {/* Second hand */}
        <Line
          x1={center}
          y1={center}
          x2={center + secondLen * Math.cos(secondRad)}
          y2={center + secondLen * Math.sin(secondRad)}
          stroke={theme.colors.primary}
          strokeWidth={SECOND_HAND_WIDTH}
          strokeLinecap="round"
        />

        {/* Center cap */}
        <Circle
          cx={center}
          cy={center}
          r={CENTER_OUTER_R}
          fill={theme.colors.onSurface}
        />
        <Circle
          cx={center}
          cy={center}
          r={CENTER_INNER_R}
          fill={theme.colors.primary}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
});
