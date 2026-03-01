import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface GameOverlayProps {
  isGameOver: boolean;
  hasWon: boolean;
  wonAcknowledged: boolean;
  onKeepGoing: () => void;
  onTryAgain: () => void;
}

export function GameOverlay({
  isGameOver,
  hasWon,
  wonAcknowledged,
  onKeepGoing,
  onTryAgain,
}: GameOverlayProps) {
  const { t } = useTranslation();

  // Show overlay only when:
  // 1. Game is over (lost)
  // 2. Won for the first time (before acknowledging)
  if (!isGameOver && !(hasWon && !wonAcknowledged)) return null;

  const isWin = hasWon && !wonAcknowledged;

  return (
    <View style={styles.overlay} testID="game-overlay">
      <Text variant="headlineMedium" style={styles.title}>
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
    backgroundColor: "rgba(238, 228, 218, 0.73)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  title: {
    fontWeight: "bold",
    color: "#776e65",
    marginBottom: 16,
  },
  buttons: {
    gap: 12,
    alignItems: "center",
  },
});
