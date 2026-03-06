import { useAtomValue } from "jotai";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { spacing } from "../../../app/spacing";
import { primaryTimeDisplayAtom } from "../../../atoms/settingsAtoms";
import { useCurrentTime } from "../../../hooks/useCurrentTime";
import { AnalogClock } from "../components/AnalogClock";
import { CustomDayIndicator } from "../components/CustomDayIndicator";
import { DigitalClock } from "../components/DigitalClock";
import { TimeToggle } from "../components/TimeToggle";

type ClockMode = "analog" | "digital";

export function ClockScreen() {
  const { realTimeMs, customTime, cycleLengthMinutes } = useCurrentTime();
  const primaryTimeDisplay = useAtomValue(primaryTimeDisplayAtom);
  const [clockMode, setClockMode] = useState<ClockMode>("analog");
  const { t } = useTranslation();

  const toggleClockMode = useCallback(() => {
    setClockMode((prev) => (prev === "analog" ? "digital" : "analog"));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} testID="clock-screen">
      <CustomDayIndicator realTimeMs={realTimeMs} />
      <Pressable
        onPress={toggleClockMode}
        accessibilityLabel={t("clock.toggleMode")}
        accessibilityRole="button"
        testID="clock-mode-toggle-area"
      >
        <View style={styles.clockArea}>
          {clockMode === "analog" ? (
            <View style={styles.clockSection}>
              <AnalogClock
                customTime={customTime}
                cycleLengthMinutes={cycleLengthMinutes}
                mode={primaryTimeDisplay}
                realTimeMs={realTimeMs}
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
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: spacing.base,
  },
  clockArea: {
    alignItems: "center",
    gap: spacing.base,
  },
  clockSection: {
    marginVertical: spacing.sm,
  },
  toggleSection: {
    width: "100%",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
});
