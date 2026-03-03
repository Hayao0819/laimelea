import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { Snackbar, Text } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { useTimers } from "../../../hooks/useTimers";
import type { TimerState } from "../../../models/Timer";
import { NumpadInput } from "./NumpadInput";
import { TimerCard } from "./TimerCard";

export function CountdownTimer() {
  const { t } = useTranslation();
  const { timers, addTimer, deleteTimer, pauseTimer, resumeTimer, resetTimer } =
    useTimers();
  const [showComplete, setShowComplete] = useState(false);
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
        setShowComplete(true);
      }
    }
    prevTimersRef.current = timers;
  }, [timers]);

  const handleStart = useCallback(
    (durationMs: number) => {
      addTimer(durationMs);
    },
    [addTimer],
  );

  const renderItem = useCallback(
    ({ item }: { item: TimerState }) => (
      <TimerCard
        timer={item}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onReset={resetTimer}
        onDelete={deleteTimer}
      />
    ),
    [pauseTimer, resumeTimer, resetTimer, deleteTimer],
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
        />
      ) : (
        <View style={styles.empty}>
          <Text variant="bodyLarge" testID="no-timers-text">
            {t("timer.noTimers")}
          </Text>
        </View>
      )}
      <NumpadInput onStart={handleStart} />
      <Snackbar
        visible={showComplete}
        onDismiss={() => setShowComplete(false)}
        duration={3000}
      >
        {t("timer.complete")}
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
