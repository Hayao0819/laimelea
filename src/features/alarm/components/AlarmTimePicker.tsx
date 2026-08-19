import React, { useEffect, useRef, useState } from "react";
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
  const maxMinutesOfDay =
    timeSystem === "custom"
      ? Math.max(0, Math.floor(cycleLengthMinutes) - 1)
      : 23 * 60 + 59;
  const maxHours = Math.floor(maxMinutesOfDay / 60);
  const maxMinutesForHour = (hours: number) =>
    hours === maxHours ? maxMinutesOfDay % 60 : 59;

  const [hoursText, setHoursText] = useState(pad2(value.hours));
  const [minutesText, setMinutesText] = useState(pad2(value.minutes));
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const latestValue = useRef(value);

  useEffect(() => {
    latestValue.current = value;
    if (!isEditingHours) {
      setHoursText(pad2(value.hours));
    }
  }, [value, isEditingHours]);

  useEffect(() => {
    if (!isEditingMinutes) {
      setMinutesText(pad2(value.minutes));
    }
  }, [value, isEditingMinutes]);

  const updateValue = (nextValue: TimeValue) => {
    latestValue.current = nextValue;
    onChange(nextValue);
  };

  const clampHours = (text: string) => {
    const num = Number(text);
    return Number.isFinite(num)
      ? Math.min(Math.max(0, Math.floor(num)), maxHours)
      : 0;
  };

  const clampMinutes = (text: string, hours: number) => {
    const num = Number(text);
    return Number.isFinite(num)
      ? Math.min(Math.max(0, Math.floor(num)), maxMinutesForHour(hours))
      : 0;
  };

  const handleHoursChange = (text: string) => {
    setHoursText(text);
    const hours = clampHours(text);
    const minutes = Math.min(
      latestValue.current.minutes,
      maxMinutesForHour(hours),
    );
    updateValue({ hours, minutes });
  };

  const handleMinutesChange = (text: string) => {
    setMinutesText(text);
    const hours = latestValue.current.hours;
    updateValue({ hours, minutes: clampMinutes(text, hours) });
  };

  const handleHoursBlur = () => {
    setIsEditingHours(false);
    setHoursText(pad2(latestValue.current.hours));
  };

  const handleMinutesBlur = () => {
    setIsEditingMinutes(false);
    setMinutesText(pad2(latestValue.current.minutes));
  };

  return (
    <View style={styles.container} testID="alarm-time-picker">
      <TextInput
        mode="outlined"
        keyboardType="numeric"
        value={hoursText}
        onChangeText={handleHoursChange}
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
        onChangeText={handleMinutesChange}
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
