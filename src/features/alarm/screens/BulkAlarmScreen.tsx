import notifee from "@notifee/react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAtom, useAtomValue } from "jotai";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Snackbar, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import type { Alarm, BulkAlarmParams } from "../../../models/Alarm";
import type { DismissalMethod } from "../../../models/Settings";
import type { RootStackParamList } from "../../../navigation/types";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import { BulkAlarmForm } from "../components/BulkAlarmForm";
import { cancelAlarm, scheduleAlarm } from "../services/alarmScheduler";
import {
  ANDROID_ALARM_TRIGGER_LIMIT,
  generateBulkAlarms,
} from "../services/bulkAlarmCreator";

type Props = NativeStackScreenProps<RootStackParamList, "BulkAlarm">;

export function BulkAlarmScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const { t } = useTranslation();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
  const existingEnabledAlarmCount = useMemo(
    () => alarms.filter((alarm) => alarm.enabled).length,
    [alarms],
  );

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
      snoozeDurationMin: defaults.snoozeDurationMin,
      snoozeMaxCount: defaults.snoozeMaxCount,
      mathDifficulty: defaults.mathDifficulty,
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
    () =>
      generateBulkAlarms(
        bulkParams,
        cycleConfig,
        defaults,
        existingEnabledAlarmCount,
      ),
    [bulkParams, cycleConfig, defaults, existingEnabledAlarmCount],
  );

  const handleSave = useCallback(async () => {
    if (preview.alarms.length === 0 || preview.limitExceeded || saving) return;

    setSaving(true);
    const rollbackAlarms: Alarm[] = [];
    try {
      const triggerIds = await notifee.getTriggerNotificationIds();
      if (
        triggerIds.length + preview.alarms.length >
        ANDROID_ALARM_TRIGGER_LIMIT
      ) {
        Alert.alert(
          t("alarm.bulkCreate"),
          t("alarm.bulkWarningLimit", {
            total: triggerIds.length + preview.alarms.length,
          }),
        );
        return;
      }
      const scheduledAlarms: Alarm[] = [];
      for (const alarm of preview.alarms) {
        rollbackAlarms.push(alarm);
        const triggerId = await scheduleAlarm(alarm);
        const scheduledAlarm = { ...alarm, notifeeTriggerId: triggerId };
        rollbackAlarms[rollbackAlarms.length - 1] = scheduledAlarm;
        scheduledAlarms.push(scheduledAlarm);
      }
      setAlarms([...alarms, ...scheduledAlarms]);
      requestClockWidgetUpdate();
      setSnackMessage(
        t("alarm.bulkCreated", { count: scheduledAlarms.length }),
      );
      navigation.goBack();
    } catch {
      await Promise.allSettled(
        rollbackAlarms.map((alarm) => cancelAlarm(alarm)),
      );
      Alert.alert(t("alarm.bulkCreate"), t("alarm.bulkCreateFailed"));
    } finally {
      setSaving(false);
    }
  }, [preview, saving, alarms, setAlarms, navigation, t]);

  const SaveButton = useCallback(
    () => (
      <IconButton
        icon="check"
        onPress={handleSave}
        disabled={
          preview.alarms.length === 0 || preview.limitExceeded || saving
        }
        testID="bulk-save-button"
        accessibilityLabel={t("alarm.bulkSave")}
      />
    ),
    [handleSave, preview.alarms.length, preview.limitExceeded, saving, t],
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingRight: spacing.base + insets.right,
            paddingBottom: spacing.base + insets.bottom,
            paddingLeft: spacing.base + insets.left,
          },
        ]}
        testID="bulk-alarm-scroll"
      >
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
          existingAlarmCount={existingEnabledAlarmCount}
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
    padding: spacing.base,
  },
});
