import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

interface GameOverlayProps {
  isGameOver: boolean;
  hasWon: boolean;
  wonAcknowledged: boolean;
  canUndo: boolean;
  onKeepGoing: () => void;
  onTryAgain: () => void;
  onUndo: () => void;
}

export function GameOverlay({
  isGameOver,
  hasWon,
  wonAcknowledged,
  canUndo,
  onKeepGoing,
  onTryAgain,
  onUndo,
}: GameOverlayProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Show overlay only when:
  // 1. Game is over (lost)
  // 2. Won for the first time (before acknowledging)
  if (!isGameOver && !(hasWon && !wonAcknowledged)) return null;

  const isWin = hasWon && !wonAcknowledged;

  return (
    <View
      style={[
        styles.overlay,
        theme.dark ? styles.overlayDark : styles.overlayLight,
      ]}
      testID="game-overlay"
    >
      <Text
        variant="headlineMedium"
        style={[styles.title, { color: theme.colors.onSurface }]}
      >
        {isWin ? t("game2048.youWin") : t("game2048.gameOver")}
      </Text>
      <View style={styles.buttons}>
        {isWin && (
          <Button
            mode="contained"
            onPress={onKeepGoing}
            testID="keep-going-button"
          >
            {t("game2048.keepGoing")}
          </Button>
        )}
        {isGameOver && canUndo && (
          <Button
            mode="contained"
            onPress={onUndo}
            icon="undo"
            testID="undo-button-overlay"
          >
            {t("game2048.undo")}
          </Button>
        )}
        <Button mode="outlined" onPress={onTryAgain} testID="try-again-button">
          {t("game2048.tryAgain")}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  buttons: {
    gap: 12,
    alignItems: "center",
  },
  overlayDark: {
    backgroundColor: "rgba(26, 28, 25, 0.8)",
  },
  overlayLight: {
    backgroundColor: "rgba(203, 232, 193, 0.8)",
  },
});
