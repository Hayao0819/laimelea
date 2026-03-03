import { useAtom, useAtomValue } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet,View } from "react-native";
import { Button, Card, Chip, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { cycleEstimationAtom } from "../../../atoms/sleepAtoms";

const CONFIDENCE_COLORS: Record<
  "low" | "medium" | "high",
  { bg: string; text: string }
> = {
  low: { bg: "#FFCDD2", text: "#C62828" },
  medium: { bg: "#FFF9C4", text: "#F57F17" },
  high: { bg: "#C8E6C9", text: "#2E7D32" },
};

export function CycleEstimateCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const estimation = useAtomValue(cycleEstimationAtom);
  const [settings, setSettings] = useAtom(settingsAtom);

  const handleApply = useCallback(() => {
    if (!estimation) return;
    setSettings({
      ...settings,
      cycleConfig: {
        ...settings.cycleConfig,
        cycleLengthMinutes: estimation.periodMinutes,
      },
    });
  }, [estimation, settings, setSettings]);

  if (!estimation) {
    return (
      <Card
        style={styles.card}
        mode="outlined"
        testID="cycle-estimate-card-empty"
      >
        <Card.Content>
          <Text variant="titleMedium" accessibilityRole="header">
            {t("sleep.cycleEstimate")}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("sleep.notEnoughData")}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  const hours = Math.floor(estimation.periodMinutes / 60);
  const minutes = Math.round(estimation.periodMinutes % 60);
  const confidenceColor = CONFIDENCE_COLORS[estimation.confidence];

  return (
    <Card style={styles.card} mode="outlined" testID="cycle-estimate-card">
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t("sleep.cycleEstimate")}
          </Text>
          <Chip
            compact
            style={{ backgroundColor: confidenceColor.bg }}
            textStyle={{ color: confidenceColor.text }}
            testID="confidence-chip"
          >
            {t(`sleep.confidence.${estimation.confidence}`)}
          </Chip>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text variant="bodySmall" style={styles.statLabel}>
              {t("sleep.period")}
            </Text>
            <Text variant="titleLarge">
              {hours}
              {t("sleep.hours")} {minutes}
              {t("sleep.minutes")}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="bodySmall" style={styles.statLabel}>
              {t("sleep.drift")}
            </Text>
            <Text variant="titleMedium">
              {estimation.driftMinutesPerDay > 0 ? "+" : ""}
              {estimation.driftMinutesPerDay.toFixed(1)}
              {t("sleep.minutes")}/{t("sleep.day")}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.detailText}>
            R² = {estimation.r2.toFixed(2)}
          </Text>
          <Text variant="bodySmall" style={styles.detailText}>
            {t("sleep.dataPoints")}: {estimation.dataPointsUsed}
          </Text>
        </View>

        <Button
          mode="contained"
          onPress={handleApply}
          style={styles.applyButton}
          testID="apply-cycle-button"
          accessibilityLabel={t("sleep.applyCycle")}
        >
          {t("sleep.applyCycle")}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  emptyText: {
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    opacity: 0.7,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: "row",
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  detailText: {
    opacity: 0.6,
  },
  applyButton: {
    marginTop: spacing.md,
  },
});
