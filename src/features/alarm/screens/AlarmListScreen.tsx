import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAtom, useAtomValue } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { FAB, Snackbar, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import type { Alarm } from "../../../models/Alarm";
import type { RootStackParamList } from "../../../navigation/types";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import { AlarmCard } from "../components/AlarmCard";
import { getAlarmToSchedule } from "../services/alarmRescheduler";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../services/alarmScheduler";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AlarmListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const [snackMessage, setSnackMessage] = React.useState("");
  const [fabOpen, setFabOpen] = React.useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const visibleAlarms = alarms.filter((alarm) => !alarm.isTest);

  const handleToggle = useCallback(
    async (alarm: Alarm) => {
      const updated: Alarm = {
        ...alarm,
        enabled: !alarm.enabled,
        updatedAt: Date.now(),
      };

      if (updated.enabled) {
        const alarmToSchedule = getAlarmToSchedule(
          updated,
          settings.cycleConfig,
        );
        if (!alarmToSchedule) {
          Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
          return;
        }
        try {
          const triggerId = await scheduleAlarm(alarmToSchedule);
          updated.targetTimestampMs = alarmToSchedule.targetTimestampMs;
          updated.skipNextOccurrence = alarmToSchedule.skipNextOccurrence;
          updated.notifeeTriggerId = triggerId;
        } catch {
          Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
          return;
        }
        setSnackMessage(t("alarm.scheduled"));
      } else {
        try {
          await cancelAlarm(alarm);
        } catch {
          const recoveredAlarm = await recoverAlarmSchedule(alarm);
          setAlarms(
            alarms.map((storedAlarm) =>
              storedAlarm.id === alarm.id ? recoveredAlarm : storedAlarm,
            ),
          );
          Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
          return;
        }
        updated.notifeeTriggerId = null;
      }

      setAlarms(alarms.map((a) => (a.id === alarm.id ? updated : a)));
      requestClockWidgetUpdate();
    },
    [alarms, setAlarms, settings.cycleConfig, t],
  );

  const handlePress = useCallback(
    (alarm: Alarm) => {
      navigation.navigate("AlarmEdit", { alarmId: alarm.id });
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    async (alarm: Alarm) => {
      try {
        await cancelAlarm(alarm);
        setAlarms(alarms.filter((a) => a.id !== alarm.id));
        requestClockWidgetUpdate();
      } catch {
        const recoveredAlarm = await recoverAlarmSchedule(alarm);
        setAlarms(
          alarms.map((storedAlarm) =>
            storedAlarm.id === alarm.id ? recoveredAlarm : storedAlarm,
          ),
        );
        Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
      }
    },
    [alarms, setAlarms, t],
  );

  const handleSkipNext = useCallback(
    async (alarm: Alarm) => {
      const alarmToSchedule = getAlarmToSchedule(
        { ...alarm, skipNextOccurrence: true },
        settings.cycleConfig,
      );
      if (!alarmToSchedule) {
        Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
        return;
      }

      try {
        await cancelAlarm(alarm);
        const triggerId = await scheduleAlarm(alarmToSchedule);
        const now = Date.now();
        setAlarms(
          alarms.map((current) =>
            current.id === alarm.id
              ? {
                  ...alarmToSchedule,
                  notifeeTriggerId: triggerId,
                  updatedAt: now,
                }
              : current,
          ),
        );
        requestClockWidgetUpdate();
      } catch {
        const recoveredAlarm = await recoverAlarmSchedule(alarm);
        setAlarms(
          alarms.map((storedAlarm) =>
            storedAlarm.id === alarm.id ? recoveredAlarm : storedAlarm,
          ),
        );
        Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
      }
    },
    [alarms, setAlarms, settings.cycleConfig, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: Alarm }) => (
      <AlarmCard
        alarm={item}
        cycleConfig={settings.cycleConfig}
        onToggle={handleToggle}
        onSkipNext={handleSkipNext}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    ),
    [
      settings.cycleConfig,
      handleToggle,
      handleSkipNext,
      handlePress,
      handleLongPress,
    ],
  );

  const keyExtractor = useCallback((item: Alarm) => item.id, []);

  return (
    <View style={styles.container} testID="alarm-list-screen">
      {visibleAlarms.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyLarge" testID="no-alarms-text">
            {t("alarm.noAlarms")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleAlarms}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.list,
            {
              paddingLeft: spacing.base + insets.left,
              paddingRight: spacing.base + insets.right,
            },
          ]}
          testID="alarm-list"
        />
      )}
      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? "close" : "plus"}
        accessibilityLabel={t("alarm.newAlarm")}
        actions={[
          {
            icon: "alarm-plus",
            label: t("alarm.newAlarm"),
            onPress: () => navigation.navigate("AlarmEdit", {}),
            testID: "add-alarm-fab",
            accessibilityLabel: t("alarm.newAlarm"),
          },
          {
            icon: "playlist-plus",
            label: t("alarm.bulkCreate"),
            onPress: () => navigation.navigate("BulkAlarm"),
            testID: "bulk-create-fab",
            accessibilityLabel: t("alarm.bulkCreate"),
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        fabStyle={{ backgroundColor: theme.colors.primaryContainer }}
        testID="alarm-fab-group"
      />
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
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    paddingVertical: spacing.sm,
    paddingBottom: 80,
    flexGrow: 1,
  },
});
