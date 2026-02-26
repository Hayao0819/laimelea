import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useCurrentTime } from "../../../hooks/useCurrentTime";
import { CustomDayIndicator } from "../components/CustomDayIndicator";
import { AnalogClock } from "../components/AnalogClock";
import { DigitalClock } from "../components/DigitalClock";
import { TimeToggle } from "../components/TimeToggle";

export function ClockScreen() {
  const { realTimeMs, customTime, cycleLengthMinutes } = useCurrentTime();

  return (
    <ScrollView contentContainerStyle={styles.container} testID="clock-screen">
      <CustomDayIndicator customTime={customTime} />
      <View style={styles.clockSection}>
        <AnalogClock
          customTime={customTime}
          cycleLengthMinutes={cycleLengthMinutes}
        />
      </View>
      <DigitalClock realTimeMs={realTimeMs} customTime={customTime} />
      <View style={styles.toggleSection}>
        <TimeToggle />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  clockSection: {
    marginVertical: 8,
  },
  toggleSection: {
    width: "100%",
    paddingHorizontal: 32,
    marginTop: 8,
  },
});
