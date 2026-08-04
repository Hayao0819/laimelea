import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { List, SegmentedButtons, Switch, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import {
  type AlarmDeliveryStatus,
  ensureNotificationPermissions,
  getAlarmDeliveryStatus,
  openExactAlarmPermissionSettings,
  openFullScreenIntentPermissionSettings,
} from "../../../core/notifications/notifeeSetup";
import type { DismissalMethod, MathDifficulty } from "../../../models/Settings";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";

const GRADUAL_VOLUME_OPTIONS = [0, 15, 30, 60];
const SNOOZE_DURATION_OPTIONS = [1, 3, 5, 10, 15];
const SNOOZE_MAX_OPTIONS = [1, 2, 3, 5, 10];

function cycleNext<T>(options: T[], current: T): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

export function AlarmDefaultsScreen() {
  const { t } = useTranslation();
  const { settings, updateAlarmDefaults } = useSettingsUpdate();
  const insets = useSafeAreaInsets();
  const [deliveryStatus, setDeliveryStatus] =
    useState<AlarmDeliveryStatus | null>(null);

  const refreshDeliveryStatus = useCallback(async () => {
    try {
      setDeliveryStatus(await getAlarmDeliveryStatus());
    } catch {
      setDeliveryStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshDeliveryStatus().catch(() => {});
  }, [refreshDeliveryStatus]);

  const openDeliveryPermission = useCallback(async () => {
    if (!deliveryStatus?.notificationsEnabled) {
      await ensureNotificationPermissions();
    } else if (!deliveryStatus.exactAlarmsEnabled) {
      await openExactAlarmPermissionSettings();
    } else if (!deliveryStatus.fullScreenIntentEnabled) {
      await openFullScreenIntentPermissionSettings();
    }
    await refreshDeliveryStatus();
  }, [deliveryStatus, refreshDeliveryStatus]);

  const deliveryDescription = !deliveryStatus
    ? t("settings.alarmDeliveryChecking")
    : !deliveryStatus.notificationsEnabled
      ? t("settings.alarmDeliveryNotificationsDisabled")
      : !deliveryStatus.exactAlarmsEnabled
        ? t("settings.alarmDeliveryExactAlarmsDisabled")
        : !deliveryStatus.fullScreenIntentEnabled
          ? t("settings.alarmDeliveryFullScreenDisabled")
          : t("settings.alarmDeliveryReady");

  const renderVibrationSwitch = useCallback(
    () => (
      <Switch
        value={settings.alarmDefaults.vibrationEnabled}
        onValueChange={(v) => updateAlarmDefaults({ vibrationEnabled: v })}
        testID="vibration-switch"
      />
    ),
    [settings.alarmDefaults.vibrationEnabled, updateAlarmDefaults],
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        {
          paddingBottom: spacing.xl + insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      testID="alarm-defaults-screen"
    >
      <List.Section>
        <List.Subheader>{t("settings.alarmDefaults")}</List.Subheader>
        <View style={styles.segmentContainer} testID="dismissal-segment">
          <Text variant="bodyMedium" style={styles.segmentLabel}>
            {t("settings.dismissalMethod")}
          </Text>
          <SegmentedButtons<DismissalMethod>
            value={settings.alarmDefaults.dismissalMethod}
            onValueChange={(v) => updateAlarmDefaults({ dismissalMethod: v })}
            buttons={[
              { value: "simple", label: "Simple" },
              { value: "shake", label: "Shake" },
              { value: "math", label: "Math" },
            ]}
          />
        </View>
        <List.Item
          title={t("settings.gradualVolume")}
          description={t("settings.gradualVolumeSec", {
            sec: settings.alarmDefaults.gradualVolumeDurationSec,
          })}
          onPress={() =>
            updateAlarmDefaults({
              gradualVolumeDurationSec: cycleNext(
                GRADUAL_VOLUME_OPTIONS,
                settings.alarmDefaults.gradualVolumeDurationSec,
              ),
            })
          }
          testID="gradual-volume-item"
        />
        <List.Item
          title={t("settings.snoozeDuration")}
          description={`${settings.alarmDefaults.snoozeDurationMin} min`}
          onPress={() =>
            updateAlarmDefaults({
              snoozeDurationMin: cycleNext(
                SNOOZE_DURATION_OPTIONS,
                settings.alarmDefaults.snoozeDurationMin,
              ),
            })
          }
          testID="snooze-duration-item"
        />
        <List.Item
          title={t("settings.snoozeMaxCount")}
          description={`${settings.alarmDefaults.snoozeMaxCount}`}
          onPress={() =>
            updateAlarmDefaults({
              snoozeMaxCount: cycleNext(
                SNOOZE_MAX_OPTIONS,
                settings.alarmDefaults.snoozeMaxCount,
              ),
            })
          }
          testID="snooze-max-item"
        />
        <List.Item
          title={t("settings.vibration")}
          right={renderVibrationSwitch}
          testID="vibration-item"
        />
        <List.Item
          title={t("settings.alarmDelivery")}
          description={deliveryDescription}
          onPress={() => {
            openDeliveryPermission().catch(() => {});
          }}
          testID="alarm-delivery-item"
        />
        {settings.alarmDefaults.dismissalMethod === "math" && (
          <View
            style={styles.segmentContainer}
            testID="math-difficulty-segment"
          >
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.mathDifficulty")}
            </Text>
            <SegmentedButtons
              value={String(settings.alarmDefaults.mathDifficulty)}
              onValueChange={(v) =>
                updateAlarmDefaults({
                  mathDifficulty: Number(v) as MathDifficulty,
                })
              }
              buttons={[
                { value: "1", label: t("settings.mathDifficultyEasy") },
                { value: "2", label: t("settings.mathDifficultyMedium") },
                { value: "3", label: t("settings.mathDifficultyHard") },
              ]}
            />
          </View>
        )}
        <View style={styles.segmentContainer} testID="volume-button-segment">
          <Text variant="bodyMedium" style={styles.segmentLabel}>
            {t("settings.volumeButton")}
          </Text>
          <SegmentedButtons<"snooze" | "dismiss" | "volume">
            value={settings.alarmDefaults.volumeButtonBehavior}
            onValueChange={(v) =>
              updateAlarmDefaults({ volumeButtonBehavior: v })
            }
            buttons={[
              {
                value: "snooze",
                label: t("settings.volumeButtonSnooze"),
              },
              {
                value: "dismiss",
                label: t("settings.volumeButtonDismiss"),
              },
              {
                value: "volume",
                label: t("settings.volumeButtonVolume"),
              },
            ]}
          />
        </View>
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  segmentContainer: {
    paddingHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  segmentLabel: {
    marginBottom: spacing.sm,
  },
});
