import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { spacing } from "../../../app/spacing";

interface GameHeaderProps {
  score: number;
  bestScore: number;
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
}

export function GameHeader({
  score,
  bestScore,
  canUndo,
  onUndo,
  onNewGame,
}: GameHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.container} testID="game-header">
      <View style={styles.scores}>
        <View
          style={[
            styles.scoreBox,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text variant="labelSmall">{t("game2048.score")}</Text>
          <Text variant="titleMedium" style={styles.scoreValue}>
            {score}
          </Text>
        </View>
        <View
          style={[
            styles.scoreBox,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text variant="labelSmall">{t("game2048.best")}</Text>
          <Text variant="titleMedium" style={styles.scoreValue}>
            {bestScore}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={onUndo}
          disabled={!canUndo}
          compact
          testID="undo-button"
          icon="undo"
        >
          {t("game2048.undo")}
        </Button>
        <Button
          mode="contained"
          onPress={onNewGame}
          compact
          testID="new-game-button"
        >
          {t("game2048.newGame")}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  scores: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scoreBox: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
    minWidth: 72,
  },
  scoreValue: {
    fontWeight: "bold",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
