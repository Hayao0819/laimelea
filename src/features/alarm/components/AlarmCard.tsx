import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Icon, Switch, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import type { Alarm } from "../../../models/Alarm";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import type { CycleConfig } from "../../../models/CustomTime";

interface AlarmCardProps {
  alarm: Alarm;
  cycleConfig: CycleConfig;
  onToggle: (alarm: Alarm) => void;
  onPress: (alarm: Alarm) => void;
  onLongPress: (alarm: Alarm) => void;
}

export function AlarmCard({
  alarm,
  cycleConfig,
  onToggle,
  onPress,
  onLongPress,
}: AlarmCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const timeDisplay =
    alarm.setInTimeSystem === "custom"
      ? formatCustomTimeShort(
          realToCustom(alarm.targetTimestampMs, cycleConfig),
        )
      : format(new Date(alarm.targetTimestampMs), "HH:mm");

  const repeatLabel = alarm.repeat
    ? alarm.repeat.type === "weekdays" && alarm.repeat.weekdays
      ? alarm.repeat.weekdays.length === 7
        ? t("alarm.repeat")
        : alarm.repeat.weekdays
            .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
            .join(", ")
      : t("alarm.repeat")
    : null;

  return (
    <Card
      style={[styles.card, !alarm.enabled && styles.disabled]}
      onPress={() => onPress(alarm)}
      onLongPress={() => onLongPress(alarm)}
      testID={`alarm-card-${alarm.id}`}
      accessibilityLabel={`${alarm.label || t("alarm.title")}, ${timeDisplay}, ${alarm.enabled ? t("alarm.enabled") : t("alarm.disabled")}`}
      accessibilityHint={t("alarm.editAlarm")}
    >
      <Card.Content style={styles.content}>
        <Text
          variant="headlineMedium"
          style={[
            styles.time,
            !alarm.enabled && { color: theme.colors.onSurfaceDisabled },
          ]}
        >
          {timeDisplay}
        </Text>
        <View style={styles.labelRow}>
          <Text
            variant="bodyMedium"
            style={
              !alarm.enabled
                ? { color: theme.colors.onSurfaceDisabled }
                : undefined
            }
          >
            {alarm.label || t("alarm.title")}
          </Text>
          {alarm.linkedCalendarEventId != null && (
            <Icon
              source="calendar"
              size={16}
              color={theme.colors.primary}
              testID={`alarm-calendar-badge-${alarm.id}`}
            />
          )}
        </View>
        {repeatLabel && (
          <Text variant="bodySmall" style={styles.repeat}>
            {repeatLabel}
          </Text>
        )}
      </Card.Content>
      <Card.Actions style={styles.actions}>
        <Switch
          value={alarm.enabled}
          onValueChange={() => onToggle(alarm)}
          testID={`alarm-switch-${alarm.id}`}
          accessibilityLabel={`${alarm.label || t("alarm.title")} ${alarm.enabled ? t("alarm.enabled") : t("alarm.disabled")}`}
          accessibilityRole="switch"
        />
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    paddingRight: 64,
  },
  time: {
    fontVariant: ["tabular-nums"],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  repeat: {
    marginTop: 2,
  },
  actions: {
    position: "absolute",
    right: 8,
    top: 8,
  },
});
