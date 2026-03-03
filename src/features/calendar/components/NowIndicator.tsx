import React from "react";
import { StyleSheet, View } from "react-native";

interface NowIndicatorProps {
  topOffset: number;
}

const INDICATOR_COLOR = "#EF4444";
const DOT_SIZE = 8;

export function NowIndicator({ topOffset }: NowIndicatorProps) {
  return (
    <View
      style={[styles.container, { top: topOffset }]}
      accessibilityLabel="Now indicator"
      testID="now-indicator"
    >
      <View style={styles.dot} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: INDICATOR_COLOR,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: INDICATOR_COLOR,
  },
});
