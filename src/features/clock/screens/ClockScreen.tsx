import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useCurrentTime } from "../../../hooks/useCurrentTime";
import { CustomDayIndicator } from "../components/CustomDayIndicator";
import { AnalogClock } from "../components/AnalogClock";
import { DigitalClock } from "../components/DigitalClock";
import { TimeToggle } from "../components/TimeToggle";

type ClockMode = "analog" | "digital";

export function ClockScreen() {
  const { realTimeMs, customTime, cycleLengthMinutes } = useCurrentTime();
  const [clockMode, setClockMode] = useState<ClockMode>("analog");

  const toggleClockMode = useCallback(() => {
    setClockMode((prev) => (prev === "analog" ? "digital" : "analog"));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} testID="clock-screen">
      <CustomDayIndicator customTime={customTime} />
      <TouchableWithoutFeedback onPress={toggleClockMode}>
        <View style={styles.clockArea}>
          {clockMode === "analog" ? (
            <View style={styles.clockSection}>
              <AnalogClock
                customTime={customTime}
                cycleLengthMinutes={cycleLengthMinutes}
              />
            </View>
          ) : null}
          <DigitalClock realTimeMs={realTimeMs} customTime={customTime} />
        </View>
      </TouchableWithoutFeedback>
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
  clockArea: {
    alignItems: "center",
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
