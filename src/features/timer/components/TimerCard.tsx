import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Card, IconButton, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import type { TimerState } from "../../../models/Timer";
import { CircularProgress } from "./CircularProgress";

interface Props {
  timer: TimerState;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onReset: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerCard({
  timer,
  onPause,
  onResume,
  onReset,
  onDelete,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const progress =
    timer.durationMs > 0 ? timer.remainingMs / timer.durationMs : 0;
  const isComplete = timer.remainingMs <= 0 && !timer.isRunning;

  return (
    <Card
      style={[
        styles.card,
        isComplete && { backgroundColor: theme.colors.errorContainer },
      ]}
      testID={`timer-card-${timer.id}`}
      accessibilityLabel={`${timer.label}, ${isComplete ? t("timer.complete") : formatTime(timer.remainingMs)}`}
    >
      <Card.Content style={styles.content}>
        <CircularProgress progress={progress} size={56} strokeWidth={4} />
        <View style={styles.info}>
          <Text
            variant="headlineSmall"
            style={[
              styles.time,
              isComplete && { color: theme.colors.onErrorContainer },
            ]}
          >
            {isComplete ? t("timer.complete") : formatTime(timer.remainingMs)}
          </Text>
          <Text
            variant="bodySmall"
            style={
              isComplete ? { color: theme.colors.onErrorContainer } : undefined
            }
          >
            {timer.label}
          </Text>
        </View>
      </Card.Content>
      <Card.Actions>
        {timer.isRunning ? (
          <IconButton
            icon="pause"
            onPress={() => onPause(timer.id)}
            testID={`timer-pause-${timer.id}`}
            accessibilityLabel="pause timer"
          />
        ) : timer.remainingMs > 0 ? (
          <IconButton
            icon="play"
            onPress={() => onResume(timer.id)}
            testID={`timer-resume-${timer.id}`}
            accessibilityLabel="resume timer"
          />
        ) : null}
        <IconButton
          icon="restart"
          onPress={() => onReset(timer.id)}
          testID={`timer-reset-${timer.id}`}
          accessibilityLabel="reset timer"
        />
        <IconButton
          icon="delete"
          onPress={() => onDelete(timer.id)}
          testID={`timer-delete-${timer.id}`}
          accessibilityLabel="delete timer"
        />
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.base,
    marginVertical: spacing.xs,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
  },
  info: {
    flex: 1,
  },
  time: {
    fontVariant: ["tabular-nums"],
  },
});
