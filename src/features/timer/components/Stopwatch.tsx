import React from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { useStopwatch } from "../../../hooks/useStopwatch";

function formatStopwatchTime(ms: number): string {
  const totalCentiseconds = Math.floor(ms / 10);
  const cs = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function Stopwatch() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { elapsedMs, isRunning, laps, start, pause, resume, reset, lap } =
    useStopwatch();

  const hasStarted = elapsedMs > 0 || isRunning;

  return (
    <View style={styles.container}>
      <Text
        variant="displayLarge"
        style={styles.display}
        testID="stopwatch-display"
        accessibilityRole="timer"
        accessibilityLabel={formatStopwatchTime(elapsedMs)}
      >
        {formatStopwatchTime(elapsedMs)}
      </Text>
      <View style={styles.buttonRow}>
        {!hasStarted ? (
          <Button
            mode="contained"
            onPress={start}
            style={styles.button}
            testID="stopwatch-start"
          >
            {t("timer.start")}
          </Button>
        ) : isRunning ? (
          <>
            <Button
              mode="contained"
              onPress={pause}
              style={styles.button}
              testID="stopwatch-pause"
            >
              {t("timer.pause")}
            </Button>
            <Button
              mode="outlined"
              onPress={lap}
              style={styles.button}
              testID="stopwatch-lap"
            >
              {t("timer.lap")}
            </Button>
          </>
        ) : (
          <>
            <Button
              mode="contained"
              onPress={resume}
              style={styles.button}
              testID="stopwatch-resume"
            >
              {t("timer.resume")}
            </Button>
            <Button
              mode="outlined"
              onPress={reset}
              style={styles.button}
              testID="stopwatch-reset"
            >
              {t("timer.reset")}
            </Button>
          </>
        )}
      </View>
      {laps.length > 0 ? (
        <FlatList
          data={[...laps].reverse()}
          keyExtractor={(_, index) => String(laps.length - index)}
          style={styles.lapList}
          ItemSeparatorComponent={Divider}
          renderItem={({ item, index }) => (
            <View style={styles.lapRow}>
              <Text variant="bodyLarge">
                {t("timer.lapNumber", { number: laps.length - index })}
              </Text>
              <Text variant="bodyLarge" style={{ color: theme.colors.primary }}>
                {formatStopwatchTime(item)}
              </Text>
            </View>
          )}
        />
      ) : hasStarted ? (
        <Text
          variant="bodyMedium"
          style={[styles.noLaps, { color: theme.colors.onSurfaceVariant }]}
        >
          {t("timer.noLaps")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: spacing.base,
    paddingTop: spacing.xl,
  },
  display: {
    fontVariant: ["tabular-nums"],
    marginBottom: spacing.xl,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  button: {
    minWidth: 120,
  },
  lapList: {
    flex: 1,
    width: "100%",
  },
  lapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  noLaps: {
    marginTop: spacing.base,
  },
});
