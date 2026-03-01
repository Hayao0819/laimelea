import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, useTheme } from "react-native-paper";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import {
  game2048StoreAtom,
  resolvedStoreAtom,
  currentGameAtom,
  bestScoresAtom,
  canUndoAtom,
  snapshotsAtom,
  pushHistoryAtom,
  undoAtom,
  newGameAtom,
} from "../atoms/game2048Atoms";
import { move } from "../logic/gameEngine";
import type { Direction, BoardSize, GameSnapshot } from "../logic/gameTypes";
import { GameBoard } from "../components/GameBoard";
import { GameHeader } from "../components/GameHeader";
import { GameOverlay } from "../components/GameOverlay";
import { BoardSizeSelector } from "../components/BoardSizeSelector";
import { SaveSlotList } from "../components/SaveSlotList";

export function Game2048Screen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const store = useAtomValue(resolvedStoreAtom);
  const game = useAtomValue(currentGameAtom);
  const bestScores = useAtomValue(bestScoresAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const snapshots = useAtomValue(snapshotsAtom);
  const pushHistory = useSetAtom(pushHistoryAtom);
  const undo = useSetAtom(undoAtom);
  const startNewGame = useSetAtom(newGameAtom);
  const setStore = useSetAtom(game2048StoreAtom);

  const [saveListVisible, setSaveListVisible] = useState(false);
  const [lastDirection, setLastDirection] = useState<Direction | null>(null);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (game.isGameOver) return;
      if (game.hasWon && !game.wonAcknowledged) return;

      const result = move(game, direction);
      if (result.moved) {
        setLastDirection(direction);
        pushHistory(result.state);
      }
    },
    [game, pushHistory],
  );

  const handleNewGame = useCallback(() => {
    setLastDirection(null);
    startNewGame(game.boardSize);
  }, [game.boardSize, startNewGame]);

  const handleSizeChange = useCallback(
    (size: BoardSize) => {
      setLastDirection(null);
      startNewGame(size);
    },
    [startNewGame],
  );

  const handleKeepGoing = useCallback(() => {
    setStore({
      ...store,
      currentGame: { ...store.currentGame, wonAcknowledged: true },
    });
  }, [store, setStore]);

  const handleTryAgain = useCallback(() => {
    handleNewGame();
  }, [handleNewGame]);

  const handleSave = useCallback(
    (name: string) => {
      const snapshot: GameSnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        state: { ...game },
        timestamp: Date.now(),
        parentSnapshotId: null,
      };
      setStore({
        ...store,
        snapshots: [...store.snapshots, snapshot],
      });
    },
    [game, store, setStore],
  );

  const handleLoad = useCallback(
    (snapshot: GameSnapshot) => {
      setLastDirection(null);
      setStore({
        ...store,
        currentGame: { ...snapshot.state },
        history: [],
      });
      setSaveListVisible(false);
    },
    [store, setStore],
  );

  const handleDeleteSnapshot = useCallback(
    (snapshotId: string) => {
      setStore({
        ...store,
        snapshots: store.snapshots.filter((s) => s.id !== snapshotId),
      });
    },
    [store, setStore],
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

      <BoardSizeSelector
        size={game.boardSize}
        onSizeChange={handleSizeChange}
      />

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
          onKeepGoing={handleKeepGoing}
          onTryAgain={handleTryAgain}
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
  boardContainer: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  bottomBar: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
});
