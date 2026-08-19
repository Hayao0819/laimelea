import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { Snackbar, Text } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { useTimers } from "../../../hooks/useTimers";
import type { TimerState } from "../../../models/Timer";
import { NumpadInput } from "./NumpadInput";
import { TimerCard } from "./TimerCard";

function isTimerTriggerLimitError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimerTriggerLimitError";
}

export function CountdownTimer() {
  const { t } = useTranslation();
  const {
    timers,
    isHydrated = true,
    addTimer,
    deleteTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  } = useTimers();
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const prevTimersRef = useRef<TimerState[]>([]);

  useEffect(() => {
    const prev = prevTimersRef.current;
    for (const timer of timers) {
      const prevTimer = prev.find((p) => p.id === timer.id);
      if (
        prevTimer &&
        prevTimer.isRunning &&
        !timer.isRunning &&
        timer.remainingMs <= 0
      ) {
        setSnackbarMessage(t("timer.complete"));
      }
    }
    prevTimersRef.current = timers;
  }, [t, timers]);

  const showTimerError = useCallback(
    (error: unknown) => {
      setSnackbarMessage(
        t(
          isTimerTriggerLimitError(error)
            ? "timer.notificationLimitReached"
            : "timer.notificationFailed",
        ),
      );
    },
    [t],
  );

  const handleStart = useCallback(
    async (durationMs: number) => {
      try {
        await addTimer(durationMs);
      } catch (error) {
        showTimerError(error);
      }
    },
    [addTimer, showTimerError],
  );

  const handlePause = useCallback(
    (id: string) => {
      pauseTimer(id).catch(showTimerError);
    },
    [pauseTimer, showTimerError],
  );

  const handleResume = useCallback(
    (id: string) => {
      resumeTimer(id).catch(showTimerError);
    },
    [resumeTimer, showTimerError],
  );

  const handleReset = useCallback(
    (id: string) => {
      resetTimer(id).catch(showTimerError);
    },
    [resetTimer, showTimerError],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteTimer(id).catch(showTimerError);
    },
    [deleteTimer, showTimerError],
  );

  const renderItem = useCallback(
    ({ item }: { item: TimerState }) => (
      <TimerCard
        timer={item}
        onPause={handlePause}
        onResume={handleResume}
        onReset={handleReset}
        onDelete={handleDelete}
        disabled={!isHydrated}
      />
    ),
    [handlePause, handleResume, handleReset, handleDelete, isHydrated],
  );

  const keyExtractor = useCallback((item: TimerState) => item.id, []);

  return (
    <View style={styles.container}>
      {timers.length > 0 ? (
        <FlatList
          data={timers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          testID="timer-list"
        />
      ) : (
        <View style={styles.empty}>
          <Text variant="bodyLarge" testID="no-timers-text">
            {t("timer.noTimers")}
          </Text>
        </View>
      )}
      <NumpadInput onStart={handleStart} disabled={!isHydrated} />
      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
