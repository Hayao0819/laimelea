import React, { useCallback } from "react";
import { View, StyleSheet } from "react-native";
import {
  TextInput,
  SegmentedButtons,
  Surface,
  List,
  Text,
  Chip,
  Banner,
  Portal,
  Dialog,
  RadioButton,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { AlarmTimePicker } from "./AlarmTimePicker";
import { getAllStrategies, getStrategy } from "../strategies";
import type { Alarm } from "../../../models/Alarm";
import type { DismissalMethod } from "../../../models/Settings";

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
        <Text variant="labelLarge" style={styles.sectionLabel}>
          {t("alarm.bulkFrom")}
        </Text>
        <AlarmTimePicker
          value={fromTime}
          timeSystem={timeSystem}
          cycleLengthMinutes={cycleLengthMinutes}
          onChange={onFromTimeChange}
        />
        <Text variant="labelLarge" style={styles.sectionLabel}>
          {t("alarm.bulkTo")}
        </Text>
        <AlarmTimePicker
          value={toTime}
          timeSystem={timeSystem}
          cycleLengthMinutes={cycleLengthMinutes}
          onChange={onToTimeChange}
        />
        <SegmentedButtons
          value={timeSystem}
          onValueChange={(v) => onTimeSystemChange(v as "custom" | "24h")}
          buttons={[
            { value: "custom", label: t("clock.customTime") },
            { value: "24h", label: t("clock.standardTime") },
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
        <Text variant="titleMedium" style={styles.previewTitle}>
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
    gap: 16,
  },
  timeCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
  },
  sectionLabel: {
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  segment: {
    marginTop: 8,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  previewCard: {
    padding: 16,
    borderRadius: 16,
  },
  previewTitle: {
    marginBottom: 8,
  },
  noAlarms: {
    opacity: 0.6,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {},
  warningBanner: {
    borderRadius: 12,
  },
});
