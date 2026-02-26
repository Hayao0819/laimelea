import React, { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import {
  TextInput,
  Button,
  Text,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { format } from "date-fns";
import { sleepSessionsAtom } from "../../../atoms/sleepAtoms";
import type { RootStackParamList } from "../../../navigation/types";
import type { SleepSession } from "../../../models/SleepSession";

type Props = NativeStackScreenProps<RootStackParamList, "ManualSleepEntry">;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseDateTimeToMs(dateStr: string, timeStr: string): number | null {
  if (!DATE_PATTERN.test(dateStr) || !TIME_PATTERN.test(timeStr)) {
    return null;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  return d.getTime();
}

export function ManualSleepEntryScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const theme = useTheme();
  const [sessions, setSessions] = useAtom(sleepSessionsAtom);

  const sessionId = route.params?.sessionId;
  const existingSession = useMemo(
    () => sessions.find((s) => s.id === sessionId),
    [sessions, sessionId],
  );

  const now = useMemo(() => new Date(), []);

  const [startDate, setStartDate] = useState(
    existingSession
      ? format(new Date(existingSession.startTimestampMs), "yyyy-MM-dd")
      : format(now, "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = useState(
    existingSession
      ? format(new Date(existingSession.startTimestampMs), "HH:mm")
      : "23:00",
  );
  const [endDate, setEndDate] = useState(
    existingSession
      ? format(new Date(existingSession.endTimestampMs), "yyyy-MM-dd")
      : format(now, "yyyy-MM-dd"),
  );
  const [endTime, setEndTime] = useState(
    existingSession
      ? format(new Date(existingSession.endTimestampMs), "HH:mm")
      : "07:00",
  );

  const [snackbar, setSnackbar] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existingSession
        ? t("sleep.manualEntry")
        : t("sleep.manualEntry"),
    });
  }, [navigation, existingSession, t]);

  const handleSave = useCallback(() => {
    try {
      const startMs = parseDateTimeToMs(startDate, startTime);
      const endMs = parseDateTimeToMs(endDate, endTime);

      if (startMs == null || endMs == null) {
        setSnackbar(t("sleep.validationError"));
        return;
      }

      if (endMs <= startMs) {
        setSnackbar(t("sleep.validationError"));
        return;
      }

      if (startMs > Date.now()) {
        setSnackbar(t("sleep.validationError"));
        return;
      }

      const durationMs = endMs - startMs;
      if (durationMs > MAX_DURATION_MS) {
        setSnackbar(t("sleep.validationError"));
        return;
      }

      const timestamp = Date.now();

      if (existingSession) {
        const updated: SleepSession = {
          ...existingSession,
          startTimestampMs: startMs,
          endTimestampMs: endMs,
          durationMs,
          updatedAt: timestamp,
        };
        setSessions(sessions.map((s) => (s.id === sessionId ? updated : s)));
      } else {
        const newSession: SleepSession = {
          id: generateId(),
          source: "manual",
          startTimestampMs: startMs,
          endTimestampMs: endMs,
          stages: [],
          durationMs,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        setSessions([...sessions, newSession]);
      }

      navigation.goBack();
    } catch {
      setSnackbar(t("sleep.validationError"));
    }
  }, [
    startDate,
    startTime,
    endDate,
    endTime,
    existingSession,
    sessionId,
    sessions,
    setSessions,
    navigation,
    t,
  ]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="manual-sleep-entry-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t("sleep.sleepStart")}
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={t("sleep.date")}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            style={styles.input}
            testID="start-date-input"
          />
          <TextInput
            mode="outlined"
            label={t("sleep.time")}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            style={styles.input}
            testID="start-time-input"
          />
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t("sleep.sleepEnd")}
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={t("sleep.date")}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            style={styles.input}
            testID="end-date-input"
          />
          <TextInput
            mode="outlined"
            label={t("sleep.time")}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            style={styles.input}
            testID="end-time-input"
          />
        </View>

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          testID="save-button"
        >
          {t("common.save")}
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbar != null}
        onDismiss={() => setSnackbar(null)}
        duration={3000}
        testID="manual-entry-snackbar"
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
  scroll: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  input: {
    flex: 1,
  },
  saveButton: {
    marginTop: 24,
  },
});
