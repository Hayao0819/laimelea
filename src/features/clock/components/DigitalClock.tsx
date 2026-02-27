import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { formatCustomTime } from "../../../core/time/formatting";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import type { CustomTimeValue } from "../../../models/CustomTime";

interface Props {
  realTimeMs: number;
  customTime: CustomTimeValue;
}

export function DigitalClock({ realTimeMs, customTime }: Props) {
  const settings = useAtomValue(settingsAtom);
  const { t } = useTranslation();

  const customFormatted = formatCustomTime(customTime);
  const realFormatted = format(
    new Date(realTimeMs),
    settings.timeFormat === "12h" ? "hh:mm:ss a" : "HH:mm:ss",
  );

  const primaryText =
    settings.primaryTimeDisplay === "custom" ? customFormatted : realFormatted;
  const secondaryText =
    settings.primaryTimeDisplay === "custom" ? realFormatted : customFormatted;

  return (
    <View
      style={styles.container}
      testID="digital-clock"
      accessibilityRole="timer"
    >
      <Text
        variant="displayLarge"
        style={styles.primary}
        accessibilityLabel={`${settings.primaryTimeDisplay === "custom" ? t("clock.customTime") : t("clock.realTime")}: ${primaryText}`}
      >
        {primaryText}
      </Text>
      <Text
        variant="titleMedium"
        style={styles.secondary}
        accessibilityLabel={`${settings.primaryTimeDisplay === "custom" ? t("clock.realTime") : t("clock.customTime")}: ${secondaryText}`}
      >
        {secondaryText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  primary: {
    fontVariant: ["tabular-nums"],
  },
  secondary: {
    fontVariant: ["tabular-nums"],
    opacity: 0.7,
  },
});
