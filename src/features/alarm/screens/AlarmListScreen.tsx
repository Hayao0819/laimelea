import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { FAB, Snackbar, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import type { Alarm } from "../../../models/Alarm";
import type { RootStackParamList } from "../../../navigation/types";
import { AlarmCard } from "../components/AlarmCard";
import { useAlarmMutations } from "../hooks/useAlarmMutations";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AlarmListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { alarms, cycleConfig, setAlarmEnabled, skipNextAlarm, deleteAlarm } =
    useAlarmMutations();
  const [snackMessage, setSnackMessage] = React.useState("");
  const [fabOpen, setFabOpen] = React.useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const visibleAlarms = alarms.filter((alarm) => !alarm.isTest);

  const handleToggle = useCallback(
    async (alarm: Alarm) => {
      try {
        await setAlarmEnabled(alarm, !alarm.enabled);
        if (!alarm.enabled) {
          setSnackMessage(t("alarm.scheduled"));
        }
      } catch {
        Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
      }
    },
    [setAlarmEnabled, t],
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
        await deleteAlarm(alarm);
      } catch {
        Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
      }
    },
    [deleteAlarm, t],
  );

  const handleSkipNext = useCallback(
    async (alarm: Alarm) => {
      try {
        await skipNextAlarm(alarm);
      } catch {
        Alert.alert(t("alarm.saveAlarm"), t("alarm.scheduleFailed"));
      }
    },
    [skipNextAlarm, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: Alarm }) => (
      <AlarmCard
        alarm={item}
        cycleConfig={cycleConfig}
        onToggle={handleToggle}
        onSkipNext={handleSkipNext}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    ),
    [cycleConfig, handleToggle, handleSkipNext, handlePress, handleLongPress],
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
