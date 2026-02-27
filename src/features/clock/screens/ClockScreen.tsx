import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useCurrentTime } from "../../../hooks/useCurrentTime";
import { CustomDayIndicator } from "../components/CustomDayIndicator";
import { AnalogClock } from "../components/AnalogClock";
import { DigitalClock } from "../components/DigitalClock";
import { TimeToggle } from "../components/TimeToggle";

type ClockMode = "analog" | "digital";

export function ClockScreen() {
  const { realTimeMs, customTime, cycleLengthMinutes } = useCurrentTime();
  const [clockMode, setClockMode] = useState<ClockMode>("analog");
  const { t } = useTranslation();

  const toggleClockMode = useCallback(() => {
    setClockMode((prev) => (prev === "analog" ? "digital" : "analog"));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} testID="clock-screen">
      <CustomDayIndicator customTime={customTime} />
      <Pressable
        onPress={toggleClockMode}
        accessibilityLabel={t("clock.toggleMode")}
        accessibilityRole="button"
      >
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
      </Pressable>
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
