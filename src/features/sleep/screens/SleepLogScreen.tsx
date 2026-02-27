import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList, RefreshControl, StyleSheet, Pressable } from "react-native";
import {
  Text,
  Card,
  FAB,
  Portal,
  Dialog,
  Button,
  Snackbar,
  Chip,
  useTheme,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { useSleepSync } from "../../../hooks/useSleepSync";
import { CycleEstimateCard } from "../components/CycleEstimateCard";
import { SleepDriftChart } from "../components/SleepDriftChart";
import type { SleepSession } from "../../../models/SleepSession";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatTime(ms: number): string {
  return format(new Date(ms), "HH:mm");
}

function formatDate(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd");
}

export function SleepLogScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sessions, loading, error, sync, deleteEntry } = useSleepSync();
  const [deleteTarget, setDeleteTarget] = useState<SleepSession | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setSnackbar(t("sleep.syncError"));
    }
  }, [error, t]);

  // Auto-sync when tab is focused and cache is stale
  useFocusEffect(
    useCallback(() => {
      sync();
    }, [sync]),
  );

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => b.startTimestampMs - a.startTimestampMs,
      ),
    [sessions],
  );

  const handleAddEntry = useCallback(() => {
    navigation.navigate("ManualSleepEntry", {});
  }, [navigation]);

  const handleEditEntry = useCallback(
    (session: SleepSession) => {
      if (session.source === "manual") {
        navigation.navigate("ManualSleepEntry", { sessionId: session.id });
      }
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    (session: SleepSession) => {
      if (session.source === "manual") {
        setDeleteTarget(session);
      }
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    sync(true);
  }, [sync]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteEntry(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteEntry]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SleepSession }) => (
      <Pressable
        onPress={() => handleEditEntry(item)}
        onLongPress={() => handleLongPress(item)}
        disabled={item.source !== "manual"}
        accessibilityLabel={`${formatDate(item.startTimestampMs)}, ${formatTime(item.startTimestampMs)} - ${formatTime(item.endTimestampMs)}, ${t("sleep.duration")}: ${formatDuration(item.durationMs)}`}
        accessibilityRole="button"
      >
        <Card style={styles.sessionCard} mode="outlined">
          <Card.Content style={styles.sessionContent}>
            <View style={styles.sessionHeader}>
              <Text variant="titleSmall">
                {formatDate(item.startTimestampMs)}
              </Text>
              <Chip compact>
                {item.source === "manual"
                  ? t("sleep.sourceManual")
                  : t("sleep.sourceHealthConnect")}
              </Chip>
            </View>
            <View style={styles.sessionDetails}>
              <View style={styles.timeBlock}>
                <Text variant="bodySmall" style={styles.timeLabel}>
                  {t("sleep.sleepStart")}
                </Text>
                <Text variant="bodyLarge" style={styles.timeValue}>
                  {formatTime(item.startTimestampMs)}
                </Text>
              </View>
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                →
              </Text>
              <View style={styles.timeBlock}>
                <Text variant="bodySmall" style={styles.timeLabel}>
                  {t("sleep.sleepEnd")}
                </Text>
                <Text variant="bodyLarge" style={styles.timeValue}>
                  {formatTime(item.endTimestampMs)}
                </Text>
              </View>
              <View style={styles.durationBlock}>
                <Text variant="bodySmall" style={styles.timeLabel}>
                  {t("sleep.duration")}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.primary }}
                >
                  {formatDuration(item.durationMs)}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </Pressable>
    ),
    [handleEditEntry, handleLongPress, theme, t],
  );

  const keyExtractor = useCallback((item: SleepSession) => item.id, []);

  const renderEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <Text variant="bodyLarge">{t("sleep.noData")}</Text>
      </View>
    ),
    [t],
  );

  const renderHeader = useCallback(
    () => (
      <View>
        <CycleEstimateCard />
        {sortedSessions.length > 0 && (
          <SleepDriftChart sessions={sortedSessions} />
        )}
      </View>
    ),
    [sortedSessions],
  );

  return (
    <View style={styles.container} testID="sleep-log-screen">
      <FlatList
        data={sortedSessions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        contentContainerStyle={
          sortedSessions.length === 0 ? styles.emptyList : styles.list
        }
        testID="sleep-session-list"
      />

      <FAB
        icon="plus"
        onPress={handleAddEntry}
        style={styles.fab}
        testID="add-sleep-fab"
        accessibilityLabel={t("sleep.addEntry")}
      />

      <Portal>
        <Dialog
          visible={deleteTarget != null}
          onDismiss={handleCancelDelete}
          testID="delete-dialog"
        >
          <Dialog.Content>
            <Text>{t("sleep.deleteConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancelDelete}>{t("common.cancel")}</Button>
            <Button onPress={handleConfirmDelete} testID="confirm-delete-button">
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar != null}
        onDismiss={() => setSnackbar(null)}
        duration={3000}
      >
        {snackbar ?? ""}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 64,
  },
  sessionCard: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  sessionContent: {
    paddingVertical: 8,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeBlock: {
    alignItems: "center",
  },
  timeLabel: {
    opacity: 0.7,
  },
  timeValue: {
    fontVariant: ["tabular-nums"],
  },
  durationBlock: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
});
