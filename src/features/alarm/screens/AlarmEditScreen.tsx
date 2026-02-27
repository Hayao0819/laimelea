import React, { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  TextInput,
  SegmentedButtons,
  List,
  Switch,
  Surface,
  Button,
  IconButton,
  Divider,
  Portal,
  Dialog,
  RadioButton,
  useTheme,
} from "react-native-paper";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { customToReal, realToCustom } from "../../../core/time/conversions";
import { scheduleAlarm, cancelAlarm } from "../services/alarmScheduler";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import { AlarmTimePicker } from "../components/AlarmTimePicker";
import { getAllStrategies, getStrategy } from "../strategies";
import type { Alarm } from "../../../models/Alarm";
import type { DismissalMethod } from "../../../models/Settings";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmEdit">;

export function AlarmEditScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);

  const alarmId = route.params?.alarmId;
  const existingAlarm = useMemo(
    () => alarms.find((a) => a.id === alarmId),
    [alarms, alarmId],
  );

  const defaults = settings.alarmDefaults;
  const cycleConfig = settings.cycleConfig;

  const [timeSystem, setTimeSystem] = useState<"custom" | "24h">(
    existingAlarm?.setInTimeSystem ?? settings.primaryTimeDisplay,
  );

  const initialTime = useMemo(() => {
    if (existingAlarm) {
      if (existingAlarm.setInTimeSystem === "custom") {
        const ct = realToCustom(existingAlarm.targetTimestampMs, cycleConfig);
        return { hours: ct.hours, minutes: ct.minutes };
      }
      const d = new Date(existingAlarm.targetTimestampMs);
      return { hours: d.getHours(), minutes: d.getMinutes() };
    }
    return { hours: 7, minutes: 0 };
  }, [existingAlarm, cycleConfig]);

  const [time, setTime] = useState(initialTime);
  const [label, setLabel] = useState(existingAlarm?.label ?? "");
  const [vibration, setVibration] = useState(
    existingAlarm?.vibrationEnabled ?? defaults.vibrationEnabled,
  );
  const [snoozeDuration] = useState(
    existingAlarm?.snoozeDurationMin ?? defaults.snoozeDurationMin,
  );
  const [snoozeMax] = useState(
    existingAlarm?.snoozeMaxCount ?? defaults.snoozeMaxCount,
  );
  const [autoSilenceMin] = useState(existingAlarm?.autoSilenceMin ?? 15);
  const [dismissalMethod, setDismissalMethod] = useState<DismissalMethod>(
    existingAlarm?.dismissalMethod ?? defaults.dismissalMethod,
  );
  const [dismissalDialogVisible, setDismissalDialogVisible] = useState(false);

  const computeTargetTimestamp = useCallback(() => {
    if (timeSystem === "custom") {
      return customToReal(
        { day: 0, hours: time.hours, minutes: time.minutes, seconds: 0 },
        cycleConfig,
      );
    }
    const now = new Date();
    const target = new Date(now);
    target.setHours(time.hours, time.minutes, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }, [time, timeSystem, cycleConfig]);

  const handleSave = useCallback(async () => {
    const targetTimestampMs = computeTargetTimestamp();
    const now = Date.now();

    const alarm: Alarm = {
      id: existingAlarm?.id ?? `alarm-${now}`,
      label,
      enabled: true,
      targetTimestampMs,
      setInTimeSystem: timeSystem,
      repeat: existingAlarm?.repeat ?? null,
      dismissalMethod,
      gradualVolumeDurationSec:
        existingAlarm?.gradualVolumeDurationSec ??
        defaults.gradualVolumeDurationSec,
      snoozeDurationMin: snoozeDuration,
      snoozeMaxCount: snoozeMax,
      snoozeCount: 0,
      autoSilenceMin,
      soundUri: existingAlarm?.soundUri ?? null,
      vibrationEnabled: vibration,
      notifeeTriggerId: null,
      skipNextOccurrence: false,
      linkedCalendarEventId: existingAlarm?.linkedCalendarEventId ?? null,
      linkedEventOffsetMs: existingAlarm?.linkedEventOffsetMs ?? 0,
      lastFiredAt: existingAlarm?.lastFiredAt ?? null,
      createdAt: existingAlarm?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingAlarm) {
      await cancelAlarm(existingAlarm);
    }

    try {
      const triggerId = await scheduleAlarm(alarm);
      alarm.notifeeTriggerId = triggerId;
    } catch {
      // Scheduling may fail on some devices; save alarm data regardless
    }

    if (existingAlarm) {
      setAlarms(alarms.map((a) => (a.id === alarm.id ? alarm : a)));
    } else {
      setAlarms([...alarms, alarm]);
    }

    requestClockWidgetUpdate();
    navigation.goBack();
  }, [
    computeTargetTimestamp,
    existingAlarm,
    label,
    timeSystem,
    dismissalMethod,
    defaults,
    snoozeDuration,
    snoozeMax,
    autoSilenceMin,
    vibration,
    alarms,
    setAlarms,
    navigation,
  ]);

  const handleDelete = useCallback(async () => {
    if (!existingAlarm) return;
    Alert.alert(t("alarm.deleteConfirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await cancelAlarm(existingAlarm);
          setAlarms(alarms.filter((a) => a.id !== existingAlarm.id));
          requestClockWidgetUpdate();
          navigation.goBack();
        },
      },
    ]);
  }, [existingAlarm, alarms, setAlarms, navigation, t]);

  const SaveButton = useCallback(
    () => (
      <IconButton
        icon="check"
        onPress={handleSave}
        testID="save-button"
        accessibilityLabel={t("alarm.saveAlarm")}
      />
    ),
    [handleSave, t],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existingAlarm ? t("alarm.editAlarm") : t("alarm.newAlarm"),
      headerRight: SaveButton,
    });
  }, [navigation, existingAlarm, t, SaveButton]);

  const currentStrategy = getStrategy(dismissalMethod);

  const renderDismissalIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon={currentStrategy?.icon ?? "gesture-tap"} />
    ),
    [currentStrategy],
  );

  const renderSnoozeIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon="alarm-snooze" />
    ),
    [],
  );

  const renderVibrateIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon="vibrate" />
    ),
    [],
  );

  const renderVibrationSwitch = useCallback(
    () => (
      <Switch
        value={vibration}
        onValueChange={setVibration}
        testID="vibration-switch"
        accessibilityLabel={t("alarm.vibration")}
        accessibilityRole="switch"
      />
    ),
    [vibration, t],
  );

  const renderSilenceIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon="volume-off" />
    ),
    [],
  );

  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="alarm-edit-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Surface style={styles.timeCard} elevation={0}>
          <AlarmTimePicker
            value={time}
            timeSystem={timeSystem}
            cycleLengthMinutes={cycleConfig.cycleLengthMinutes}
            onChange={setTime}
          />
          <SegmentedButtons
            value={timeSystem}
            onValueChange={(v) => setTimeSystem(v as "custom" | "24h")}
            buttons={[
              { value: "custom", label: t("clock.customTime") },
              { value: "24h", label: t("clock.realTime") },
            ]}
            style={styles.segment}
          />
        </Surface>

        <TextInput
          label={t("alarm.label")}
          value={label}
          onChangeText={setLabel}
          mode="outlined"
          style={styles.input}
          testID="label-input"
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
            testID="dismissal-method-item"
          />
          <Divider />
          <List.Item
            title={t("alarm.snooze")}
            description={t("alarm.snoozeSettings", {
              duration: snoozeDuration,
              max: snoozeMax,
            })}
            left={renderSnoozeIcon}
          />
          <Divider />
          <List.Item
            title={t("alarm.vibration")}
            left={renderVibrateIcon}
            right={renderVibrationSwitch}
          />
          <Divider />
          <List.Item
            title={t("alarm.autoSilence")}
            description={t("alarm.autoSilenceMin", { minutes: autoSilenceMin })}
            left={renderSilenceIcon}
          />
        </Surface>

        {existingAlarm && (
          <Button
            mode="outlined"
            onPress={handleDelete}
            textColor="red"
            style={styles.deleteButton}
            testID="delete-button"
            accessibilityLabel={t("alarm.deleteAlarm")}
          >
            {t("common.delete")}
          </Button>
        )}
      </ScrollView>
      <Portal>
        <Dialog
          visible={dismissalDialogVisible}
          onDismiss={() => setDismissalDialogVisible(false)}
          testID="dismissal-dialog"
        >
          <Dialog.Title>{t("alarm.dismissal")}</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={dismissalMethod}
              onValueChange={(value) => {
                setDismissalMethod(value as DismissalMethod);
                setDismissalDialogVisible(false);
              }}
            >
              {getAllStrategies().map((strategy) => (
                <RadioButton.Item
                  key={strategy.id}
                  label={t(strategy.displayName)}
                  value={strategy.id}
                  testID={`dismissal-option-${strategy.id}`}
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
    flex: 1,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  timeCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  segment: {
    marginTop: 16,
  },
  input: {},
  settingsCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  deleteButton: {
    marginTop: 8,
  },
});
