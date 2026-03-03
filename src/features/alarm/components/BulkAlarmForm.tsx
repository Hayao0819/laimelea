import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet,View } from "react-native";
import {
  Banner,
  Chip,
  Dialog,
  List,
  Portal,
  RadioButton,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";

import { radius,spacing } from "../../../app/spacing";
import type { Alarm } from "../../../models/Alarm";
import type { DismissalMethod } from "../../../models/Settings";
import { getAllStrategies, getStrategy } from "../strategies";
import { AlarmTimePicker } from "./AlarmTimePicker";

interface TimeValue {
  hours: number;
  minutes: number;
}

interface BulkAlarmFormProps {
  fromTime: TimeValue;
  toTime: TimeValue;
  timeSystem: "custom" | "24h";
  intervalMinutes: string;
  dismissalMethod: DismissalMethod;
  label: string;
  cycleLengthMinutes: number;
  previewAlarms: Alarm[];
  warning: string | null;
  existingAlarmCount: number;
  onFromTimeChange: (value: TimeValue) => void;
  onToTimeChange: (value: TimeValue) => void;
  onTimeSystemChange: (value: "custom" | "24h") => void;
  onIntervalChange: (value: string) => void;
  onDismissalMethodChange: (value: DismissalMethod) => void;
  onLabelChange: (value: string) => void;
}

export function BulkAlarmForm({
  fromTime,
  toTime,
  timeSystem,
  intervalMinutes,
  dismissalMethod,
  label,
  cycleLengthMinutes,
  previewAlarms,
  warning,
  existingAlarmCount,
  onFromTimeChange,
  onToTimeChange,
  onTimeSystemChange,
  onIntervalChange,
  onDismissalMethodChange,
  onLabelChange,
}: BulkAlarmFormProps) {
  const { t } = useTranslation();
  const [dismissalDialogVisible, setDismissalDialogVisible] =
    React.useState(false);

  const currentStrategy = getStrategy(dismissalMethod);

  const renderDismissalIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon={currentStrategy?.icon ?? "gesture-tap"} />
    ),
    [currentStrategy],
  );

  const formatAlarmTime = (alarm: Alarm): string => {
    if (alarm.setInTimeSystem === "24h") {
      const d = new Date(alarm.targetTimestampMs);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    // For custom time, derive from the slot
    const totalMinutes = Math.round(
      (alarm.targetTimestampMs - alarm.createdAt) / 60000,
    );
    // Fallback: just show the target time as a date
    const d = new Date(alarm.targetTimestampMs);
    if (totalMinutes < 0) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.timeCard} elevation={0}>
        <Text
          variant="labelLarge"
          style={styles.sectionLabel}
          accessibilityRole="header"
        >
          {t("alarm.bulkFrom")}
        </Text>
        <AlarmTimePicker
          value={fromTime}
          timeSystem={timeSystem}
          cycleLengthMinutes={cycleLengthMinutes}
          onChange={onFromTimeChange}
        />
        <Text
          variant="labelLarge"
          style={styles.sectionLabel}
          accessibilityRole="header"
        >
          {t("alarm.bulkTo")}
        </Text>
        <AlarmTimePicker
          value={toTime}
          timeSystem={timeSystem}
          cycleLengthMinutes={cycleLengthMinutes}
          onChange={onToTimeChange}
        />
        <SegmentedButtons<"custom" | "24h">
          value={timeSystem}
          onValueChange={(v) => onTimeSystemChange(v)}
          buttons={[
            { value: "custom", label: t("clock.customTime") },
            { value: "24h", label: t("clock.realTime") },
          ]}
          style={styles.segment}
        />
      </Surface>

      <TextInput
        label={t("alarm.bulkInterval")}
        value={intervalMinutes}
        onChangeText={onIntervalChange}
        mode="outlined"
        keyboardType="numeric"
        testID="interval-input"
      />

      <Surface style={styles.settingsCard} elevation={0}>
        <List.Item
          title={t("alarm.dismissal")}
          description={
            currentStrategy
              ? t(currentStrategy.displayName)
              : t("dismissal.simple")
          }
          left={renderDismissalIcon}
          onPress={() => setDismissalDialogVisible(true)}
          testID="bulk-dismissal-item"
        />
      </Surface>

      <TextInput
        label={t("alarm.label")}
        value={label}
        onChangeText={onLabelChange}
        mode="outlined"
        testID="bulk-label-input"
      />

      <Surface style={styles.previewCard} elevation={0}>
        <Text
          variant="titleMedium"
          style={styles.previewTitle}
          accessibilityRole="header"
        >
          {t("alarm.bulkPreview")}
        </Text>
        {previewAlarms.length === 0 ? (
          <Text variant="bodyMedium" style={styles.noAlarms}>
            {t("alarm.bulkNoAlarms")}
          </Text>
        ) : (
          <>
            <Text variant="bodyMedium">
              {t("alarm.bulkPreviewCount", { count: previewAlarms.length })}
            </Text>
            <View style={styles.chipContainer}>
              {previewAlarms.map((alarm) => (
                <Chip key={alarm.id} compact style={styles.chip}>
                  {formatAlarmTime(alarm)}
                </Chip>
              ))}
            </View>
          </>
        )}
      </Surface>

      {warning && (
        <Banner visible icon="alert" actions={[]} style={styles.warningBanner}>
          {t(warning, {
            total: existingAlarmCount + previewAlarms.length,
          })}
        </Banner>
      )}

      <Portal>
        <Dialog
          visible={dismissalDialogVisible}
          onDismiss={() => setDismissalDialogVisible(false)}
          testID="bulk-dismissal-dialog"
        >
          <Dialog.Title>{t("alarm.dismissal")}</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={dismissalMethod}
              onValueChange={(value) => {
                onDismissalMethodChange(value as DismissalMethod);
                setDismissalDialogVisible(false);
              }}
            >
              {getAllStrategies().map((strategy) => (
                <RadioButton.Item
                  key={strategy.id}
                  label={t(strategy.displayName)}
                  value={strategy.id}
                  testID={`bulk-dismissal-option-${strategy.id}`}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.base,
  },
  timeCard: {
    padding: spacing.base,
    borderRadius: radius.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionLabel: {
    alignSelf: "flex-start",
    marginLeft: spacing.xs,
  },
  segment: {
    marginTop: spacing.sm,
  },
  settingsCard: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  previewCard: {
    padding: spacing.base,
    borderRadius: radius.md,
  },
  previewTitle: {
    marginBottom: spacing.sm,
  },
  noAlarms: {
    opacity: 0.6,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {},
  warningBanner: {
    borderRadius: 12,
  },
});
