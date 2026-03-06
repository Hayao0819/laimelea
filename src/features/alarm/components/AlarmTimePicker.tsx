import React, { useEffect, useState } from "react";
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
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

  const [hoursText, setHoursText] = useState(pad2(value.hours));
  const [minutesText, setMinutesText] = useState(pad2(value.minutes));
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);

  useEffect(() => {
    if (!isEditingHours) {
      setHoursText(pad2(value.hours));
    }
  }, [value.hours, isEditingHours]);

  useEffect(() => {
    if (!isEditingMinutes) {
      setMinutesText(pad2(value.minutes));
    }
  }, [value.minutes, isEditingMinutes]);

  const handleHoursBlur = () => {
    setIsEditingHours(false);
    const num = parseInt(hoursText, 10);
    const clamped = isNaN(num) ? 0 : Math.min(Math.max(0, num), maxHours);
    setHoursText(pad2(clamped));
    onChange({ ...value, hours: clamped });
  };

  const handleMinutesBlur = () => {
    setIsEditingMinutes(false);
    const num = parseInt(minutesText, 10);
    const clamped = isNaN(num) ? 0 : Math.min(Math.max(0, num), 59);
    setMinutesText(pad2(clamped));
    onChange({ ...value, minutes: clamped });
  };

  return (
    <View style={styles.container} testID="alarm-time-picker">
      <TextInput
        mode="outlined"
        keyboardType="numeric"
        value={hoursText}
        onChangeText={setHoursText}
        onFocus={() => setIsEditingHours(true)}
        onBlur={handleHoursBlur}
        selectTextOnFocus
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
        value={minutesText}
        onChangeText={setMinutesText}
        onFocus={() => setIsEditingMinutes(true)}
        onBlur={handleMinutesBlur}
        selectTextOnFocus
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
