import React from "react";
import { Pressable, View, StyleSheet, type DimensionValue } from "react-native";
import { Text } from "react-native-paper";
import { spacing } from "../../../app/spacing";
import type { CalendarEvent } from "../../../models/CalendarEvent";

interface TimelineEventBlockProps {
  event: CalendarEvent;
  topOffset: number;
  height: number;
  leftOffset?: number;
  widthRatio?: number;
  color: string;
  onPress?: (event: CalendarEvent) => void;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MIN_HEIGHT = 20;
const BORDER_WIDTH = 4;
const BORDER_RADIUS = 4;
const BG_OPACITY = 0.15;

export function TimelineEventBlock({
  event,
  topOffset,
  height,
  leftOffset = 0,
  widthRatio = 1,
  color,
  onPress,
}: TimelineEventBlockProps) {
  const displayHeight = Math.max(height, MIN_HEIGHT);
  const widthPercent = `${widthRatio * 100}%`;
  const leftPercent = `${leftOffset * 100}%`;

  const blockStyle = [
    styles.block,
    {
      top: topOffset,
      height: displayHeight,
      left: leftPercent as DimensionValue,
      width: widthPercent as DimensionValue,
      borderLeftColor: color,
      backgroundColor: colorWithOpacity(color, BG_OPACITY),
    },
  ];

  const inner = (
    <>
      <Text variant="bodySmall" style={styles.title} numberOfLines={1}>
        {event.title}
      </Text>
      {displayHeight >= 36 && (
        <Text variant="labelSmall" style={styles.time} numberOfLines={1}>
          {formatTime(event.startTimestampMs)} -{" "}
          {formatTime(event.endTimestampMs)}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={blockStyle}
        onPress={() => onPress(event)}
        accessibilityLabel={event.title}
        accessibilityRole="button"
        testID={`timeline-event-${event.id}`}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={blockStyle} testID={`timeline-event-${event.id}`}>
      {inner}
    </View>
  );
}

function colorWithOpacity(hex: string, opacity: number): string {
  const alphaHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  if (normalized.length === 7) {
    return `${normalized}${alphaHex}`;
  }
  return `${normalized}${alphaHex}`;
}

const styles = StyleSheet.create({
  block: {
    position: "absolute",
    borderLeftWidth: BORDER_WIDTH,
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: "hidden",
  },
  title: {
    fontWeight: "bold",
  },
  time: {
    marginTop: 1,
  },
});
