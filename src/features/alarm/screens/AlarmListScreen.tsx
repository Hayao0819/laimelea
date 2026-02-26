import React, { useCallback } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { FAB, Text, Snackbar } from "react-native-paper";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { scheduleAlarm, cancelAlarm } from "../services/alarmScheduler";
import { setupForegroundHandler } from "../../../core/notifications/foregroundHandler";
import { AlarmCard } from "../components/AlarmCard";
import type { Alarm } from "../../../models/Alarm";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AlarmListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const [snackMessage, setSnackMessage] = React.useState("");

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = setupForegroundHandler((alarmId) => {
        navigation.navigate("AlarmFiring", { alarmId });
      });
      return unsubscribe;
    }, [navigation]),
  );

  const handleToggle = useCallback(
    async (alarm: Alarm) => {
      const updated: Alarm = {
        ...alarm,
        enabled: !alarm.enabled,
        updatedAt: Date.now(),
      };

      if (updated.enabled) {
        const triggerId = await scheduleAlarm(updated);
        updated.notifeeTriggerId = triggerId;
        setSnackMessage(t("alarm.scheduled"));
      } else {
        await cancelAlarm(alarm);
        updated.notifeeTriggerId = null;
      }

      setAlarms(alarms.map((a) => (a.id === alarm.id ? updated : a)));
    },
    [alarms, setAlarms, t],
  );

  const handlePress = useCallback(
    (alarm: Alarm) => {
      navigation.navigate("AlarmEdit", { alarmId: alarm.id });
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    async (alarm: Alarm) => {
      await cancelAlarm(alarm);
      setAlarms(alarms.filter((a) => a.id !== alarm.id));
    },
    [alarms, setAlarms],
  );

  const renderItem = useCallback(
    ({ item }: { item: Alarm }) => (
      <AlarmCard
        alarm={item}
        cycleConfig={settings.cycleConfig}
        onToggle={handleToggle}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    ),
    [settings.cycleConfig, handleToggle, handlePress, handleLongPress],
  );

  const keyExtractor = useCallback((item: Alarm) => item.id, []);

  return (
    <View style={styles.container} testID="alarm-list-screen">
      {alarms.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyLarge" testID="no-alarms-text">
            {t("alarm.noAlarms")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={alarms}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          testID="alarm-list"
        />
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate("AlarmEdit", {})}
        testID="add-alarm-fab"
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
    paddingVertical: 8,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
});
