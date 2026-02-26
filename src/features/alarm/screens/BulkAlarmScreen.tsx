import React, { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { IconButton, Snackbar, useTheme } from "react-native-paper";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { scheduleAlarm } from "../services/alarmScheduler";
import { generateBulkAlarms } from "../services/bulkAlarmCreator";
import { BulkAlarmForm } from "../components/BulkAlarmForm";
import type { BulkAlarmParams } from "../../../models/Alarm";
import type { DismissalMethod } from "../../../models/Settings";

type Props = NativeStackScreenProps<RootStackParamList, "BulkAlarm">;

export function BulkAlarmScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const { t } = useTranslation();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const theme = useTheme();

  const defaults = settings.alarmDefaults;
  const cycleConfig = settings.cycleConfig;

  const [fromTime, setFromTime] = useState({ hours: 7, minutes: 0 });
  const [toTime, setToTime] = useState({ hours: 9, minutes: 0 });
  const [timeSystem, setTimeSystem] = useState<"custom" | "24h">(
    settings.primaryTimeDisplay,
  );
  const [intervalMinutes, setIntervalMinutes] = useState("30");
  const [dismissalMethod, setDismissalMethod] = useState<DismissalMethod>(
    defaults.dismissalMethod,
  );
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [snackMessage, setSnackMessage] = useState("");

  const bulkParams: BulkAlarmParams = useMemo(
    () => ({
      fromHour: fromTime.hours,
      fromMinute: fromTime.minutes,
      toHour: toTime.hours,
      toMinute: toTime.minutes,
      intervalMinutes: parseInt(intervalMinutes, 10) || 0,
      timeSystem,
      dismissalMethod,
      gradualVolumeDurationSec: defaults.gradualVolumeDurationSec,
      label,
    }),
    [
      fromTime,
      toTime,
      intervalMinutes,
      timeSystem,
      dismissalMethod,
      defaults,
      label,
    ],
  );

  const preview = useMemo(
    () => generateBulkAlarms(bulkParams, cycleConfig, defaults, alarms.length),
    [bulkParams, cycleConfig, defaults, alarms.length],
  );

  const handleSave = useCallback(async () => {
    if (preview.alarms.length === 0 || saving) return;

    setSaving(true);
    try {
      const scheduledAlarms = [];
      for (const alarm of preview.alarms) {
        const triggerId = await scheduleAlarm(alarm);
        scheduledAlarms.push({ ...alarm, notifeeTriggerId: triggerId });
      }
      setAlarms([...alarms, ...scheduledAlarms]);
      setSnackMessage(
        t("alarm.bulkCreated", { count: scheduledAlarms.length }),
      );
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Failed to create alarms");
    } finally {
      setSaving(false);
    }
  }, [preview.alarms, saving, alarms, setAlarms, navigation, t]);

  const SaveButton = useCallback(
    () => (
      <IconButton
        icon="check"
        onPress={handleSave}
        disabled={preview.alarms.length === 0 || saving}
        testID="bulk-save-button"
      />
    ),
    [handleSave, preview.alarms.length, saving],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("alarm.bulkCreate"),
      headerRight: SaveButton,
    });
  }, [navigation, t, SaveButton]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="bulk-alarm-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <BulkAlarmForm
          fromTime={fromTime}
          toTime={toTime}
          timeSystem={timeSystem}
          intervalMinutes={intervalMinutes}
          dismissalMethod={dismissalMethod}
          label={label}
          cycleLengthMinutes={cycleConfig.cycleLengthMinutes}
          previewAlarms={preview.alarms}
          warning={preview.warning}
          existingAlarmCount={alarms.length}
          onFromTimeChange={setFromTime}
          onToTimeChange={setToTime}
          onTimeSystemChange={setTimeSystem}
          onIntervalChange={setIntervalMinutes}
          onDismissalMethodChange={setDismissalMethod}
          onLabelChange={setLabel}
        />
      </ScrollView>
      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage("")}
        duration={2000}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
});
