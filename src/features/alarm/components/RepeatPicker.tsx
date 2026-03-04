import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import {
  Divider,
  List,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";

import { spacing } from "../../../app/spacing";
import type { AlarmRepeat } from "../../../models/Alarm";
import { WeekdayChips } from "./WeekdayChips";

interface RepeatPickerProps {
  repeat: AlarmRepeat | null;
  onRepeatChange: (repeat: AlarmRepeat | null) => void;
}

type RepeatMode = "none" | "weekdays" | "interval";

function getMode(repeat: AlarmRepeat | null): RepeatMode {
  if (!repeat) return "none";
  if (repeat.type === "weekdays") return "weekdays";
  if (repeat.type === "interval") return "interval";
  return "none";
}

function getRepeatDescription(
  repeat: AlarmRepeat | null,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  if (!repeat) return t("alarm.repeatNone");
  if (repeat.type === "weekdays" && repeat.weekdays) {
    const dayKeys = [
      "weekday.sun",
      "weekday.mon",
      "weekday.tue",
      "weekday.wed",
      "weekday.thu",
      "weekday.fri",
      "weekday.sat",
    ];
    return repeat.weekdays.map((d) => t(dayKeys[d])).join(", ");
  }
  if (repeat.type === "interval" && repeat.intervalMs) {
    const hours = repeat.intervalMs / 3_600_000;
    return `${hours}h`;
  }
  return t("alarm.repeatNone");
}

const MS_PER_HOUR = 3_600_000;

export function RepeatPicker({ repeat, onRepeatChange }: RepeatPickerProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const mode = getMode(repeat);
  const [intervalHours, setIntervalHours] = useState(() => {
    if (repeat?.type === "interval" && repeat.intervalMs) {
      return String(repeat.intervalMs / MS_PER_HOUR);
    }
    return "24";
  });
  const [intervalError, setIntervalError] = useState<string | null>(null);

  const handleModeChange = useCallback(
    (newMode: string) => {
      const m = newMode as RepeatMode;
      if (m === "none") {
        onRepeatChange(null);
      } else if (m === "weekdays") {
        onRepeatChange({
          type: "weekdays",
          weekdays: repeat?.weekdays ?? [],
        });
      } else if (m === "interval") {
        const hours = parseFloat(intervalHours);
        const ms =
          !isNaN(hours) && hours > 0 ? hours * MS_PER_HOUR : 24 * MS_PER_HOUR;
        setIntervalError(null);
        onRepeatChange({ type: "interval", intervalMs: ms });
      }
    },
    [onRepeatChange, repeat?.weekdays, intervalHours],
  );

  const handleDaysChange = useCallback(
    (days: number[]) => {
      if (days.length === 0) {
        onRepeatChange(null);
      } else {
        onRepeatChange({ type: "weekdays", weekdays: days });
      }
    },
    [onRepeatChange],
  );

  const handleIntervalChange = useCallback(
    (text: string) => {
      setIntervalHours(text);
      const hours = parseFloat(text);
      if (isNaN(hours) || hours <= 0) {
        setIntervalError(t("alarm.repeatIntervalHours"));
        return;
      }
      setIntervalError(null);
      onRepeatChange({ type: "interval", intervalMs: hours * MS_PER_HOUR });
    },
    [onRepeatChange, t],
  );

  const renderRepeatIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon="repeat" />
    ),
    [],
  );

  const description = getRepeatDescription(repeat, t);

  return (
    <>
      <List.Item
        title={t("alarm.repeat")}
        description={description}
        left={renderRepeatIcon}
        onPress={() => setExpanded(!expanded)}
        testID="repeat-picker-item"
      />
      {expanded && (
        <View style={styles.expandedContainer}>
          <SegmentedButtons
            value={mode}
            onValueChange={handleModeChange}
            buttons={[
              {
                value: "none",
                label: t("alarm.repeatNone"),
                testID: "repeat-mode-none",
              },
              {
                value: "weekdays",
                label: t("alarm.repeatWeekdays"),
                testID: "repeat-mode-weekdays",
              },
              {
                value: "interval",
                label: t("alarm.repeatInterval"),
                testID: "repeat-mode-interval",
              },
            ]}
            style={styles.segmentedButtons}
          />
          {mode === "weekdays" && (
            <WeekdayChips
              selectedDays={repeat?.weekdays ?? []}
              onDaysChange={handleDaysChange}
            />
          )}
          {mode === "interval" && (
            <View style={styles.intervalContainer}>
              <TextInput
                label={t("alarm.repeatIntervalHours")}
                value={intervalHours}
                onChangeText={handleIntervalChange}
                keyboardType="numeric"
                mode="outlined"
                error={intervalError !== null}
                style={styles.intervalInput}
                testID="interval-input"
              />
              {intervalError && (
                <Text
                  variant="bodySmall"
                  style={styles.errorText}
                  testID="interval-error"
                >
                  {intervalError}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
      <Divider />
    </>
  );
}

const styles = StyleSheet.create({
  expandedContainer: {
    paddingBottom: spacing.sm,
  },
  segmentedButtons: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  intervalContainer: {
    paddingHorizontal: spacing.base,
  },
  intervalInput: {
    marginBottom: spacing.xs,
  },
  errorText: {
    color: "red",
    marginBottom: spacing.xs,
  },
});
