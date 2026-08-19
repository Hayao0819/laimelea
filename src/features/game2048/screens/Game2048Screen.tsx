import { useNavigation } from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type LayoutChangeEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import {
  acknowledgeWinAtom,
  bestScoresAtom,
  canUndoAtom,
  currentGameAtom,
  deleteSnapshotAtom,
  game2048HydratedAtom,
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
import type { Direction, GameSnapshot } from "../logic/gameTypes";

export function Game2048Screen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const game = useAtomValue(currentGameAtom);
  const gameHydrated = useAtomValue(game2048HydratedAtom);
  const bestScores = useAtomValue(bestScoresAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const snapshots = useAtomValue(snapshotsAtom);
  const settings = useAtomValue(settingsAtom);
  const pushHistory = useSetAtom(pushHistoryAtom);
  const undo = useSetAtom(undoAtom);
  const startNewGame = useSetAtom(newGameAtom);
  const acknowledgeWin = useSetAtom(acknowledgeWinAtom);
  const deleteSnapshot = useSetAtom(deleteSnapshotAtom);
  const saveSnapshot = useSetAtom(saveSnapshotAtom);
  const loadSnapshot = useSetAtom(loadSnapshotAtom);
  const milestoneAutoSave = useSetAtom(milestoneAutoSaveAtom);

  const [saveListVisible, setSaveListVisible] = useState(false);
  const [lastDirection, setLastDirection] = useState<Direction | null>(null);
  const fallbackBoardSize = Math.max(
    0,
    Math.min(
      windowWidth - insets.left - insets.right - spacing.base * 2,
      windowHeight * 0.55,
    ),
  );
  const [boardSize, setBoardSize] = useState(fallbackBoardSize);

  const handleBoardAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const nextSize = Math.max(0, Math.floor(Math.min(width, height)));
    setBoardSize((current) => (current === nextSize ? current : nextSize));
  }, []);

  const gameRef = useRef(game);
  gameRef.current = game;

  const prevGameOverRef = useRef(false);
  const gameOverBaselineReadyRef = useRef(false);
  useEffect(() => {
    if (!gameHydrated) {
      gameOverBaselineReadyRef.current = false;
      return;
    }
    if (!gameOverBaselineReadyRef.current) {
      prevGameOverRef.current = game.isGameOver;
      gameOverBaselineReadyRef.current = true;
      return;
    }
    if (game.isGameOver && !prevGameOverRef.current) {
      saveSnapshot(true);
    }
    prevGameOverRef.current = game.isGameOver;
  }, [game.isGameOver, gameHydrated, saveSnapshot]);

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
    acknowledgeWin();
  }, [acknowledgeWin]);

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
      deleteSnapshot(snapshotId);
    },
    [deleteSnapshot],
  );

  if (!gameHydrated) {
    return (
      <View style={styles.loading} testID="game2048-loading">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
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

      <View
        style={styles.boardArea}
        onLayout={handleBoardAreaLayout}
        testID="game-board-area"
      >
        <View style={{ width: boardSize, height: boardSize }}>
          <GameBoard
            board={game.board}
            boardSize={game.boardSize}
            onMove={handleMove}
            direction={lastDirection}
            size={boardSize}
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
      </View>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
        testID="game-2048-bottom-bar"
      >
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.sm,
  },
  boardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 0,
  },
  bottomBar: {
    alignItems: "center",
    paddingTop: spacing.md,
  },
});
