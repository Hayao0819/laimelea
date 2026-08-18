import { useAtomValue } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { formatCustomTime } from "../../../core/time/formatting";
import {
  formatDisplayTime,
  formatTimeInZone,
} from "../../../core/time/timezone";
import type { CustomTimeValue } from "../../../models/CustomTime";

interface Props {
  realTimeMs: number;
  customTime: CustomTimeValue;
}

export function DigitalClock({ realTimeMs, customTime }: Props) {
  const settings = useAtomValue(resolvedSettingsAtom);
  const { t } = useTranslation();

  const customFormatted = formatCustomTime(customTime);
  const realFormatted = formatDisplayTime(realTimeMs, settings);
  const secondaryTimezoneFormatted = settings.secondaryTimezone
    ? formatTimeInZone(
        realTimeMs,
        settings.secondaryTimezone,
        settings.timeFormat,
      )
    : null;

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
      {secondaryTimezoneFormatted ? (
        <Text
          variant="titleMedium"
          style={styles.secondary}
          testID="secondary-timezone-clock"
        >
          {`${settings.secondaryTimezone} ${secondaryTimezoneFormatted}`}
        </Text>
      ) : null}
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
