import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Surface, Text, TextInput } from "react-native-paper";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { spacing, radius } from "../../../app/spacing";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../models/Settings";
import { realToCustom } from "../../../core/time/conversions";
import {
  formatCustomDay,
  formatCustomTime,
} from "../../../core/time/formatting";
import { DEFAULT_CYCLE_LENGTH_MINUTES } from "../../../core/time/constants";

const DEFAULT_HOURS = Math.floor(DEFAULT_CYCLE_LENGTH_MINUTES / 60);
const DEFAULT_MINUTES = DEFAULT_CYCLE_LENGTH_MINUTES % 60;

export function SetupScreen() {
  const setSettings = useSetAtom(settingsAtom);
  const { t } = useTranslation();

  const [hours, setHours] = useState(String(DEFAULT_HOURS));
  const [minutes, setMinutes] = useState(String(DEFAULT_MINUTES));
  const [baseTimeMs, setBaseTimeMs] = useState<number | null>(null);

  const cycleLengthMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const isValid = cycleLengthMinutes > 0 && baseTimeMs !== null;

  const preview = useMemo(() => {
    if (!isValid) return null;
    const config = { cycleLengthMinutes, baseTimeMs: baseTimeMs! };
    const now = Date.now();
    const custom = realToCustom(now, config);
    return `${formatCustomDay(custom)}  ${formatCustomTime(custom)}`;
  }, [cycleLengthMinutes, baseTimeMs, isValid]);

  const handleUseNow = useCallback(() => {
    setBaseTimeMs(Date.now());
  }, []);

  const handleDone = useCallback(() => {
    if (!isValid) return;
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      ...(typeof prev === "object" && prev !== null && !("then" in prev)
        ? prev
        : {}),
      cycleConfig: {
        cycleLengthMinutes,
        baseTimeMs: baseTimeMs!,
      },
      setupComplete: true,
    }));
  }, [isValid, cycleLengthMinutes, baseTimeMs, setSettings]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        variant="headlineMedium"
        style={styles.title}
        accessibilityRole="header"
      >
        {t("setup.welcome")}
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        {t("setup.description")}
      </Text>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t("setup.setCycleLength")}
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={t("setup.hours")}
            value={hours}
            onChangeText={setHours}
            keyboardType="numeric"
            style={styles.input}
            testID="cycle-hours"
          />
          <TextInput
            mode="outlined"
            label={t("setup.minutes")}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="numeric"
            style={styles.input}
            testID="cycle-minutes"
          />
        </View>
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t("setup.setBaseTime")}
        </Text>
        <Text variant="bodySmall" style={styles.hint}>
          {t("setup.baseTimeDescription")}
        </Text>
        <Button
          mode="outlined"
          onPress={handleUseNow}
          style={styles.button}
          accessibilityLabel={t("setup.useNow")}
        >
          {t("setup.useNow")}
        </Button>
        {baseTimeMs !== null && (
          <Text variant="bodyLarge" style={styles.baseTimeDisplay}>
            {format(new Date(baseTimeMs), "yyyy-MM-dd HH:mm:ss")}
          </Text>
        )}
      </Surface>

      {preview && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t("setup.preview")}
          </Text>
          <Text variant="headlineSmall" style={styles.previewText}>
            {preview}
          </Text>
        </Surface>
      )}

      <Button
        mode="contained"
        onPress={handleDone}
        disabled={!isValid}
        style={styles.doneButton}
        testID="done-button"
        accessibilityLabel={t("setup.done")}
      >
        {t("setup.done")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.base,
    paddingTop: 64,
  },
  title: {
    marginBottom: spacing.sm,
  },
  description: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.base,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
  },
  hint: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  button: {
    alignSelf: "flex-start",
  },
  baseTimeDisplay: {
    marginTop: spacing.md,
  },
  previewText: {
    marginTop: spacing.sm,
  },
  doneButton: {
    marginTop: spacing.sm,
  },
});
