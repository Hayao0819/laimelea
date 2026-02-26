import React, { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import notifee from "@notifee/react-native";
import type { RootStackParamList } from "../../../navigation/types";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import { scheduleAlarm } from "../services/alarmScheduler";
import type { Alarm } from "../../../models/Alarm";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmFiring">;

export function AlarmFiringScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const theme = useTheme();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);

  const alarm = useMemo(
    () => alarms.find((a) => a.id === route.params.alarmId),
    [alarms, route.params.alarmId],
  );

  const timeDisplay = useMemo(() => {
    if (!alarm) return "";
    return formatCustomTimeShort(
      realToCustom(alarm.targetTimestampMs, settings.cycleConfig),
    );
  }, [alarm, settings.cycleConfig]);

  const handleDismiss = useCallback(async () => {
    if (!alarm) return;
    await notifee.cancelNotification(alarm.id);
    const now = Date.now();
    setAlarms(
      alarms.map((a) =>
        a.id === alarm.id ? { ...a, lastFiredAt: now, updatedAt: now } : a,
      ),
    );
    navigation.goBack();
  }, [alarm, alarms, setAlarms, navigation]);

  const handleSnooze = useCallback(async () => {
    if (!alarm) return;
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
  }, [alarm, alarms, setAlarms, navigation]);

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
      <Text variant="displaySmall" style={styles.icon}>
        ⏰
      </Text>
      <Text variant="headlineMedium" style={styles.label}>
        {alarm.label || t("alarm.title")}
      </Text>
      <Text variant="displayLarge" style={styles.time}>
        {timeDisplay}
      </Text>
      <View style={styles.buttons}>
        {canSnooze && (
          <Button
            mode="outlined"
            onPress={handleSnooze}
            style={styles.button}
            testID="snooze-button"
          >
            {t("alarm.snoozed", { minutes: alarm.snoozeDurationMin })}
          </Button>
        )}
        <Button
          mode="contained"
          onPress={handleDismiss}
          style={styles.button}
          testID="dismiss-button"
        >
          {t("dismissal.simple")}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  label: {
    marginBottom: 8,
  },
  time: {
    fontVariant: ["tabular-nums"],
    marginBottom: 48,
  },
  buttons: {
    flexDirection: "row",
    gap: 16,
  },
  button: {
    minWidth: 120,
  },
});
