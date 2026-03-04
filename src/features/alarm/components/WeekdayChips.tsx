import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Chip } from "react-native-paper";

import { spacing } from "../../../app/spacing";

interface WeekdayChipsProps {
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
}

const WEEKDAY_KEYS = [
  "weekday.sun",
  "weekday.mon",
  "weekday.tue",
  "weekday.wed",
  "weekday.thu",
  "weekday.fri",
  "weekday.sat",
] as const;

export function WeekdayChips({ selectedDays, onDaysChange }: WeekdayChipsProps) {
  const { t } = useTranslation();

  const handleToggle = useCallback(
    (day: number) => {
      if (selectedDays.includes(day)) {
        onDaysChange(selectedDays.filter((d) => d !== day));
      } else {
        onDaysChange([...selectedDays, day].sort());
      }
    },
    [selectedDays, onDaysChange],
  );

  return (
    <View style={styles.container} testID="weekday-chips">
      {WEEKDAY_KEYS.map((key, index) => (
        <Chip
          key={key}
          selected={selectedDays.includes(index)}
          onPress={() => handleToggle(index)}
          style={styles.chip}
          testID={`weekday-chip-${index}`}
          accessibilityLabel={t(key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selectedDays.includes(index) }}
        >
          {t(key)}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  chip: {},
});
