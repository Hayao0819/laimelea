import React from "react";
import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { formatCustomDay } from "../../../core/time/formatting";
import type { CustomTimeValue } from "../../../models/CustomTime";

interface Props {
  customTime: CustomTimeValue;
}

export function CustomDayIndicator({ customTime }: Props) {
  return (
    <Text
      variant="titleLarge"
      style={styles.text}
      testID="custom-day-indicator"
      accessibilityRole="header"
    >
      {formatCustomDay(customTime)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: "center",
  },
});
