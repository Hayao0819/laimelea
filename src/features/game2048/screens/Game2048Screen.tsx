import { useNavigation } from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import {
  bestScoresAtom,
  canUndoAtom,
  currentGameAtom,
  game2048StoreAtom,
  loadSnapshotAtom,
  milestoneAutoSaveAtom,
  newGameAtom,
  pushHistoryAtom,
  saveSnapshotAtom,
  settingsAtom,
  snapshotsAtom,
  undoAtom,
} from "../atoms/game2048Atoms";
import { GameBoard } from "../components/GameBoard";
import { GameHeader } from "../components/GameHeader";
import { GameOverlay } from "../components/GameOverlay";
import { SaveSlotList } from "../components/SaveSlotList";
import { move } from "../logic/gameEngine";
import type {
  Direction,
  Game2048Store,
  GameSnapshot,
} from "../logic/gameTypes";

export function Game2048Screen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const game = useAtomValue(currentGameAtom);
  const bestScores = useAtomValue(bestScoresAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const snapshots = useAtomValue(snapshotsAtom);
  const settings = useAtomValue(settingsAtom);
  const pushHistory = useSetAtom(pushHistoryAtom);
  const undo = useSetAtom(undoAtom);
  const startNewGame = useSetAtom(newGameAtom);
  const setStore = useSetAtom(game2048StoreAtom);
  const saveSnapshot = useSetAtom(saveSnapshotAtom);
  const loadSnapshot = useSetAtom(loadSnapshotAtom);
  const milestoneAutoSave = useSetAtom(milestoneAutoSaveAtom);

  const [saveListVisible, setSaveListVisible] = useState(false);
  const [lastDirection, setLastDirection] = useState<Direction | null>(null);

  const gameRef = useRef(game);
  gameRef.current = game;

  // Auto-save on game over
  const prevGameOverRef = useRef(false);
  useEffect(() => {
    if (game.isGameOver && !prevGameOverRef.current) {
      saveSnapshot(true);
    }
    prevGameOverRef.current = game.isGameOver;
  }, [game.isGameOver, saveSnapshot]);

  const handleMove = useCallback(
    (direction: Direction) => {
      const currentGame = gameRef.current;
      if (currentGame.isGameOver) return;
      if (currentGame.hasWon && !currentGame.wonAcknowledged) return;

      const result = move(currentGame, direction, {
        luckyMode: settings.luckyMode,
      });
      if (result.moved) {
        gameRef.current = result.state;
        setLastDirection(direction);
        pushHistory(result.state);
        milestoneAutoSave(result.state);
      }
    },
    [pushHistory, milestoneAutoSave, settings.luckyMode],
  );

  const handleNewGame = useCallback(() => {
    setLastDirection(null);
    startNewGame(game.boardSize);
  }, [game.boardSize, startNewGame]);

  const handleKeepGoing = useCallback(() => {
    setStore((prev) => {
      const s = prev as Game2048Store;
      return { ...s, currentGame: { ...s.currentGame, wonAcknowledged: true } };
    });
  }, [setStore]);

  const handleTryAgain = useCallback(() => {
    handleNewGame();
  }, [handleNewGame]);

  const handleSave = useCallback(() => {
    saveSnapshot(false);
  }, [saveSnapshot]);

  const handleLoad = useCallback(
    (snapshot: GameSnapshot) => {
      setLastDirection(null);
      loadSnapshot(snapshot);
      setSaveListVisible(false);
    },
    [loadSnapshot],
  );

  const handleDeleteSnapshot = useCallback(
    (snapshotId: string) => {
      setStore((prev) => {
        const s = prev as Game2048Store;
        return {
          ...s,
          snapshots: s.snapshots.filter((sn) => sn.id !== snapshotId),
        };
      });
    },
    [setStore],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="game-2048-screen"
    >
      <GameHeader
        score={game.score}
        bestScore={bestScores[game.boardSize] ?? 0}
        canUndo={canUndo}
        onUndo={() => {
          setLastDirection(null);
          undo();
        }}
        onNewGame={handleNewGame}
      />

      <View style={styles.topButtons}>
        <IconButton
          icon="file-tree"
          onPress={() => navigation.navigate("Game2048Tree")}
          testID="tree-button"
        />
        <IconButton
          icon="cog"
          onPress={() => navigation.navigate("Game2048Settings")}
          testID="settings-button"
        />
      </View>

      <View style={styles.boardContainer}>
        <GameBoard
          board={game.board}
          boardSize={game.boardSize}
          onMove={handleMove}
          direction={lastDirection}
        />
        <GameOverlay
          isGameOver={game.isGameOver}
          hasWon={game.hasWon}
          wonAcknowledged={game.wonAcknowledged}
          canUndo={canUndo}
          onKeepGoing={handleKeepGoing}
          onTryAgain={handleTryAgain}
          onUndo={() => {
            setLastDirection(null);
            undo();
          }}
        />
      </View>

      <View style={styles.bottomBar}>
        <Button
          mode="outlined"
          onPress={() => setSaveListVisible(true)}
          icon="content-save"
          testID="open-saves-button"
        >
          {t("game2048.save")} / {t("game2048.load")}
        </Button>
      </View>

      <SaveSlotList
        visible={saveListVisible}
        onDismiss={() => setSaveListVisible(false)}
        snapshots={snapshots}
        onSave={handleSave}
        onLoad={handleLoad}
        onDelete={handleDeleteSnapshot}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.sm,
  },
  boardContainer: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  bottomBar: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
});
