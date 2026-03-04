import "../strategies"; // ensure strategies are registered

import notifee from "@notifee/react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAtom, useAtomValue } from "jotai";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import type { Alarm } from "../../../models/Alarm";
import type {
  AlarmFiringParams,
  RootStackParamList,
} from "../../../navigation/types";
import { DismissalContainer } from "../components/dismissal/DismissalContainer";
import { scheduleAlarm } from "../services/alarmScheduler";
import { GradualVolumeManager } from "../services/gradualVolumeManager";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmFiring">;

function isPreviewParams(
  params: AlarmFiringParams,
): params is { isPreview: true; alarm: Alarm } {
  return "isPreview" in params && params.isPreview === true;
}

export function AlarmFiringScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const theme = useTheme();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);

  const isPreview = isPreviewParams(route.params);

  const alarm = useMemo(() => {
    if (isPreview) {
      return route.params.alarm;
    }
    return alarms.find(
      (a) => a.id === (route.params as { alarmId: string }).alarmId,
    );
  }, [isPreview, route.params, alarms]);

  const volumeManagerRef = useRef<GradualVolumeManager | null>(null);

  // Volume button behavior
  // TODO: Capturing hardware volume button events requires a native module
  // (Android KeyEvent interception). The setting is available via
  // settings.alarmDefaults.volumeButtonBehavior ("snooze" | "dismiss" | "volume")
  // but actual interception needs NativeEventEmitter + a custom Java/Kotlin module
  // that overrides dispatchKeyEvent in the Activity.

  useEffect(() => {
    if (!alarm || isPreview) return;
    const manager = new GradualVolumeManager(alarm.gradualVolumeDurationSec);
    volumeManagerRef.current = manager;
    manager.start((_volume) => {
      // Volume control callback - native AudioManager integration point
    });
    return () => {
      manager.stop();
    };
  }, [alarm, isPreview]);

  const timeDisplay = useMemo(() => {
    if (!alarm) return "";
    return formatCustomTimeShort(
      realToCustom(alarm.targetTimestampMs, settings.cycleConfig),
    );
  }, [alarm, settings.cycleConfig]);

  const handleDismiss = useCallback(async () => {
    if (!alarm) return;
    if (isPreview) {
      navigation.goBack();
      return;
    }
    volumeManagerRef.current?.stop();
    await notifee.cancelNotification(alarm.id);
    const now = Date.now();
    setAlarms(
      alarms.map((a) =>
        a.id === alarm.id ? { ...a, lastFiredAt: now, updatedAt: now } : a,
      ),
    );
    navigation.goBack();
  }, [alarm, isPreview, alarms, setAlarms, navigation]);

  const handleSnooze = useCallback(async () => {
    if (!alarm) return;
    if (isPreview) {
      navigation.goBack();
      return;
    }
    volumeManagerRef.current?.stop();
    await notifee.cancelNotification(alarm.id);

    const snoozeMs = alarm.snoozeDurationMin * 60 * 1000;
    const snoozedAlarm: Alarm = {
      ...alarm,
      targetTimestampMs: Date.now() + snoozeMs,
      snoozeCount: alarm.snoozeCount + 1,
      updatedAt: Date.now(),
    };

    const triggerId = await scheduleAlarm(snoozedAlarm);
    snoozedAlarm.notifeeTriggerId = triggerId;

    setAlarms(alarms.map((a) => (a.id === alarm.id ? snoozedAlarm : a)));
    navigation.goBack();
  }, [alarm, isPreview, alarms, setAlarms, navigation]);

  // Auto-silence timeout
  useEffect(() => {
    if (!alarm || isPreview) return;
    if (alarm.autoSilenceMin <= 0) return;

    const timeoutMs = alarm.autoSilenceMin * 60 * 1000;
    const timer = setTimeout(() => {
      handleDismiss();
    }, timeoutMs);

    return () => {
      clearTimeout(timer);
    };
  }, [alarm, isPreview, handleDismiss]);

  if (!alarm) {
    return (
      <View style={styles.container}>
        <Text variant="bodyLarge">Alarm not found</Text>
      </View>
    );
  }

  const canSnooze = alarm.snoozeCount < alarm.snoozeMaxCount;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="alarm-firing-screen"
    >
      {isPreview && (
        <Chip
          style={styles.previewBadge}
          textStyle={{ color: theme.colors.onTertiaryContainer }}
          testID="preview-badge"
        >
          {t("alarm.previewBadge")}
        </Chip>
      )}
      <Text variant="displaySmall" style={styles.icon}>
        ⏰
      </Text>
      <Text
        variant="headlineMedium"
        style={styles.label}
        accessibilityRole="header"
      >
        {alarm.label || t("alarm.title")}
      </Text>
      <Text
        variant="displayLarge"
        style={styles.time}
        accessibilityLabel={`${t("alarm.title")}: ${timeDisplay}`}
        accessibilityRole="timer"
      >
        {timeDisplay}
      </Text>
      {isPreview ? (
        <View>
          <DismissalContainer
            method={alarm.dismissalMethod}
            difficulty={alarm.mathDifficulty ?? 1}
            onDismiss={handleDismiss}
            onSnooze={handleSnooze}
            canSnooze={canSnooze}
          />
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
            testID="close-preview-button"
          >
            {t("alarm.closePreview")}
          </Button>
        </View>
      ) : (
        <DismissalContainer
          method={alarm.dismissalMethod}
          difficulty={alarm.mathDifficulty ?? 1}
          onDismiss={handleDismiss}
          onSnooze={handleSnooze}
          canSnooze={canSnooze}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  previewBadge: {
    position: "absolute",
    top: spacing.xl,
    alignSelf: "center",
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  time: {
    fontVariant: ["tabular-nums"],
    marginBottom: 48,
  },
  closeButton: {
    marginTop: spacing.md,
  },
});
