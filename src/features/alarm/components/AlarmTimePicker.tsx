import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";

import { spacing } from "../../../app/spacing";

interface TimeValue {
  hours: number;
  minutes: number;
}

interface AlarmTimePickerProps {
  value: TimeValue;
  timeSystem: "custom" | "24h";
  cycleLengthMinutes: number;
  onChange: (value: TimeValue) => void;
}

export function AlarmTimePicker({
  value,
  timeSystem,
  cycleLengthMinutes,
  onChange,
}: AlarmTimePickerProps) {
  const { t } = useTranslation();
  const maxHours =
    timeSystem === "custom" ? Math.floor(cycleLengthMinutes / 60) - 1 : 23;

  const handleHoursChange = (text: string) => {
    const num = parseInt(text, 10);
    if (isNaN(num)) {
      onChange({ ...value, hours: 0 });
      return;
    }
    onChange({ ...value, hours: Math.min(Math.max(0, num), maxHours) });
  };

  const handleMinutesChange = (text: string) => {
    const num = parseInt(text, 10);
    if (isNaN(num)) {
      onChange({ ...value, minutes: 0 });
      return;
    }
    onChange({ ...value, minutes: Math.min(Math.max(0, num), 59) });
  };

  return (
    <View style={styles.container} testID="alarm-time-picker">
      <TextInput
        mode="outlined"
        keyboardType="numeric"
        value={String(value.hours).padStart(2, "0")}
        onChangeText={handleHoursChange}
        style={styles.input}
        maxLength={2}
        testID="hours-input"
        accessibilityLabel={t("setup.hours")}
      />
      <Text variant="headlineLarge" style={styles.separator}>
        :
      </Text>
      <TextInput
        mode="outlined"
        keyboardType="numeric"
        value={String(value.minutes).padStart(2, "0")}
        onChangeText={handleMinutesChange}
        style={styles.input}
        maxLength={2}
        testID="minutes-input"
        accessibilityLabel={t("setup.minutes")}
      />
      <Text variant="bodySmall" style={styles.maxLabel}>
        (0–{maxHours}h)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    width: 72,
    textAlign: "center",
    fontSize: 24,
  },
  separator: {
    marginBottom: spacing.xs,
  },
  maxLabel: {
    marginLeft: spacing.sm,
    opacity: 0.6,
  },
});
