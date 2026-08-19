import "../strategies";

import notifee from "@notifee/react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAtom, useAtomValue } from "jotai";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  BackHandler,
  DeviceEventEmitter,
  StyleSheet,
  View,
} from "react-native";
import { Button, Chip, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { completeAlarmFiringNavigation } from "../../../app/navigation";
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
import { enqueueAlarmMutation } from "../services/alarmMutationQueue";
import { scheduleNextAlarmOccurrence } from "../services/alarmRescheduler";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../services/alarmScheduler";
import { isSameAlarmState } from "../services/alarmStateVersion";
import { RingtoneService } from "../services/ringtoneService";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmFiring">;

function isPreviewParams(
  params: AlarmFiringParams,
): params is { isPreview: true; alarm: Alarm } {
  return "isPreview" in params && params.isPreview === true;
}

function updateStoredAlarms(
  current: Alarm[] | Promise<Alarm[]>,
  update: (alarms: Alarm[]) => Alarm[],
): Alarm[] | Promise<Alarm[]> {
  return current instanceof Promise ? current.then(update) : update(current);
}

export function AlarmFiringScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const actionInProgress = useRef(false);
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;

  const isPreview = isPreviewParams(route.params);

  const alarm = useMemo(() => {
    if (isPreview) {
      return route.params.alarm;
    }
    return alarms.find(
      (a) => a.id === (route.params as { alarmId: string }).alarmId,
    );
  }, [isPreview, route.params, alarms]);

  const activeAlarmId = isPreview ? null : alarm?.id;
  const routeAlarmId = isPreview
    ? null
    : (route.params as { alarmId: string }).alarmId;

  const closeFiringScreen = useCallback(() => {
    if (isPreview || routeAlarmId === null) {
      navigation.goBack();
      return;
    }
    completeAlarmFiringNavigation(routeAlarmId);
  }, [isPreview, navigation, routeAlarmId]);

  const persistAlarmChange = useCallback(
    async (expectedAlarm: Alarm, nextAlarm: Alarm | null) => {
      let applied = false;
      try {
        await setAlarms((currentAlarms) =>
          updateStoredAlarms(currentAlarms, (storedAlarms) => {
            const currentAlarm = storedAlarms.find(
              (storedAlarm) => storedAlarm.id === expectedAlarm.id,
            );
            if (
              currentAlarm == null ||
              !isSameAlarmState(currentAlarm, expectedAlarm)
            ) {
              return storedAlarms;
            }
            applied = true;
            return nextAlarm
              ? storedAlarms.map((storedAlarm) =>
                  storedAlarm.id === expectedAlarm.id ? nextAlarm : storedAlarm,
                )
              : storedAlarms.filter(
                  (storedAlarm) => storedAlarm.id !== expectedAlarm.id,
                );
          }),
        );
      } catch (error) {
        try {
          await setAlarms((currentAlarms) =>
            updateStoredAlarms(currentAlarms, (storedAlarms) => {
              const currentAlarm = storedAlarms.find(
                (storedAlarm) => storedAlarm.id === expectedAlarm.id,
              );
              if (
                nextAlarm &&
                currentAlarm != null &&
                isSameAlarmState(currentAlarm, nextAlarm)
              ) {
                return storedAlarms.map((storedAlarm) =>
                  storedAlarm.id === expectedAlarm.id
                    ? expectedAlarm
                    : storedAlarm,
                );
              }
              if (!nextAlarm && currentAlarm == null) {
                return [...storedAlarms, expectedAlarm];
              }
              return storedAlarms;
            }),
          );
        } catch {}
        throw error;
      }
      if (applied) {
        alarmsRef.current = nextAlarm
          ? alarmsRef.current.map((storedAlarm) =>
              storedAlarm.id === expectedAlarm.id ? nextAlarm : storedAlarm,
            )
          : alarmsRef.current.filter(
              (storedAlarm) => storedAlarm.id !== expectedAlarm.id,
            );
      }
      return applied;
    },
    [setAlarms],
  );

  const recoverCurrentAlarm = useCallback(
    async (staleAlarm: Alarm, force = false) => {
      const currentAlarm = alarmsRef.current.find(
        (storedAlarm) => storedAlarm.id === staleAlarm.id,
      );
      if (
        !currentAlarm?.enabled ||
        (!force && isSameAlarmState(currentAlarm, staleAlarm))
      ) {
        return;
      }
      const recoveredAlarm = await recoverAlarmSchedule(
        currentAlarm,
        Date.now(),
        settings.cycleConfig,
      );
      await persistAlarmChange(currentAlarm, recoveredAlarm);
    },
    [persistAlarmChange, settings.cycleConfig],
  );

  useFocusEffect(
    useCallback(() => {
      if (isPreview) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true,
      );
      return () => subscription.remove();
    }, [isPreview]),
  );

  useEffect(() => {
    if (!activeAlarmId) return;
    return () => {
      RingtoneService.stopAlarmSound(activeAlarmId).catch(() => {});
      completeAlarmFiringNavigation(activeAlarmId);
    };
  }, [activeAlarmId]);

  const timeDisplay = useMemo(() => {
    if (!alarm) return "";
    return formatCustomTimeShort(
      realToCustom(
        alarm.activeOccurrenceTimestampMs ?? alarm.targetTimestampMs,
        settings.cycleConfig,
      ),
    );
  }, [alarm, settings.cycleConfig]);

  const handleDismiss = useCallback(async () => {
    if (!alarm) return;
    if (isPreview) {
      closeFiringScreen();
      return;
    }
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      await enqueueAlarmMutation(async () => {
        const currentAlarm = alarmsRef.current.find(
          (storedAlarm) => storedAlarm.id === alarm.id,
        );
        if (!currentAlarm || !isSameAlarmState(currentAlarm, alarm)) {
          closeFiringScreen();
          return;
        }
        if (alarm.isTest) {
          await cancelAlarm(alarm);
          try {
            const persisted = await persistAlarmChange(alarm, null);
            if (!persisted) {
              await recoverCurrentAlarm(alarm, true);
            }
          } catch (error) {
            const recoveredAlarm = await recoverAlarmSchedule(
              alarm,
              Date.now(),
              settings.cycleConfig,
            );
            await persistAlarmChange(alarm, recoveredAlarm).catch(() => {});
            throw error;
          }
          closeFiringScreen();
          return;
        }

        const now = Date.now();
        const deliveredOccurrenceWasAdvanced =
          alarm.activeOccurrenceTimestampMs != null &&
          alarm.lastDeliveredOccurrenceTimestampMs ===
            alarm.activeOccurrenceTimestampMs;
        let updatedAlarm: Alarm;
        if (deliveredOccurrenceWasAdvanced) {
          await Promise.all([
            RingtoneService.stopAlarmSound(alarm.id),
            notifee.cancelDisplayedNotification(alarm.id),
          ]);
          updatedAlarm = {
            ...alarm,
            activeOccurrenceTimestampMs: null,
            snoozeCount: 0,
            updatedAt: now,
          };
        } else {
          await cancelAlarm(alarm);
          try {
            updatedAlarm = await scheduleNextAlarmOccurrence(
              alarm,
              settings.cycleConfig,
              now,
            );
          } catch {
            updatedAlarm = {
              ...alarm,
              enabled: false,
              notifeeTriggerId: null,
              updatedAt: now,
            };
            Alert.alert(t("alarm.title"), t("alarm.scheduleFailed"));
          }
          updatedAlarm.snoozeCount = 0;
        }
        updatedAlarm.lastFiredAt = now;
        let persisted: boolean;
        try {
          persisted = await persistAlarmChange(alarm, updatedAlarm);
        } catch (error) {
          if (!deliveredOccurrenceWasAdvanced && updatedAlarm.enabled) {
            await cancelAlarm(updatedAlarm).catch(() => {});
          }
          await recoverCurrentAlarm(alarm, true).catch(() => {});
          throw error;
        }
        if (!persisted) {
          if (!deliveredOccurrenceWasAdvanced && updatedAlarm.enabled) {
            await cancelAlarm(updatedAlarm).catch(() => {});
          }
          await recoverCurrentAlarm(alarm, true);
          closeFiringScreen();
          return;
        }
        closeFiringScreen();
      });
    } catch {
      Alert.alert(t("alarm.title"), t("alarm.scheduleFailed"));
      actionInProgress.current = false;
    }
  }, [
    alarm,
    closeFiringScreen,
    isPreview,
    persistAlarmChange,
    recoverCurrentAlarm,
    settings.cycleConfig,
    t,
  ]);

  const handleSnooze = useCallback(async () => {
    if (!alarm) return;
    if (isPreview) {
      closeFiringScreen();
      return;
    }
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      await enqueueAlarmMutation(async () => {
        const currentAlarm = alarmsRef.current.find(
          (storedAlarm) => storedAlarm.id === alarm.id,
        );
        if (!currentAlarm || !isSameAlarmState(currentAlarm, alarm)) {
          closeFiringScreen();
          return;
        }
        await cancelAlarm(alarm);
        const now = Date.now();
        const snoozedAlarm: Alarm = {
          ...alarm,
          enabled: true,
          targetTimestampMs: now + alarm.snoozeDurationMin * 60 * 1000,
          recurrenceAnchorTimestampMs: alarm.repeat
            ? (alarm.activeOccurrenceTimestampMs ??
              alarm.recurrenceAnchorTimestampMs ??
              alarm.targetTimestampMs)
            : null,
          activeOccurrenceTimestampMs: null,
          snoozeCount: alarm.snoozeCount + 1,
          updatedAt: now,
        };

        try {
          snoozedAlarm.notifeeTriggerId = await scheduleAlarm(snoozedAlarm);
        } catch {
          const disabledAlarm = {
            ...alarm,
            enabled: false,
            notifeeTriggerId: null,
            activeOccurrenceTimestampMs: null,
            updatedAt: now,
          };
          try {
            const persisted = await persistAlarmChange(alarm, disabledAlarm);
            if (!persisted) {
              await recoverCurrentAlarm(alarm, true);
            }
          } catch (error) {
            await recoverCurrentAlarm(alarm, true).catch(() => {});
            throw error;
          }
          Alert.alert(t("alarm.title"), t("alarm.scheduleFailed"));
          closeFiringScreen();
          return;
        }

        try {
          const persisted = await persistAlarmChange(alarm, snoozedAlarm);
          if (!persisted) {
            await cancelAlarm(snoozedAlarm);
            await recoverCurrentAlarm(alarm, true);
          }
        } catch (error) {
          await cancelAlarm(snoozedAlarm).catch(() => {});
          await recoverCurrentAlarm(alarm, true).catch(() => {});
          throw error;
        }
        closeFiringScreen();
      });
    } catch {
      Alert.alert(t("alarm.title"), t("alarm.scheduleFailed"));
      actionInProgress.current = false;
    }
  }, [
    alarm,
    closeFiringScreen,
    isPreview,
    persistAlarmChange,
    recoverCurrentAlarm,
    t,
  ]);

  const canSnooze = alarm ? alarm.snoozeCount < alarm.snoozeMaxCount : false;

  useEffect(() => {
    if (!alarm || isPreview) return;
    const configuredBehavior = settings.alarmDefaults.volumeButtonBehavior;
    const behavior =
      configuredBehavior === "snooze" && !canSnooze
        ? "dismiss"
        : configuredBehavior;
    if (behavior === "volume") {
      RingtoneService.setAlarmVolumeButtonBehavior(null).catch(() => {});
      return;
    }

    RingtoneService.setAlarmVolumeButtonBehavior(behavior).catch(() => {});
    const subscription = DeviceEventEmitter.addListener(
      "AlarmVolumeButtonPressed",
      async (action: "snooze" | "dismiss") => {
        if (action === "snooze") {
          await handleSnooze();
        } else {
          await handleDismiss();
        }
      },
    );
    return () => {
      subscription.remove();
      RingtoneService.setAlarmVolumeButtonBehavior(null).catch(() => {});
    };
  }, [
    alarm,
    canSnooze,
    handleDismiss,
    handleSnooze,
    isPreview,
    settings.alarmDefaults.volumeButtonBehavior,
  ]);

  useEffect(() => {
    if (!alarm || isPreview) return;
    if (alarm.autoSilenceMin <= 0) return;

    const occurrenceTimestampMs =
      alarm.activeOccurrenceTimestampMs ?? alarm.targetTimestampMs;
    const timeoutMs = Math.max(
      0,
      occurrenceTimestampMs + alarm.autoSilenceMin * 60 * 1000 - Date.now(),
    );
    const timer = setTimeout(async () => {
      await handleDismiss();
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + spacing.xl,
          paddingRight: insets.right + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingLeft: insets.left + spacing.xl,
        },
      ]}
      testID="alarm-firing-screen"
    >
      {isPreview && (
        <Chip
          style={[styles.previewBadge, { top: insets.top + spacing.xl }]}
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
