import React, { useMemo } from "react";
import { Dimensions, PanResponder, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { useAnimatedBoard } from "../hooks/useAnimatedBoard";
import type { Direction } from "../logic/gameTypes";
import { AnimatedGameTile } from "./AnimatedGameTile";
import { GameTile } from "./GameTile";

interface GameBoardProps {
  board: number[][];
  boardSize: number;
  onMove: (direction: Direction) => void;
  direction: Direction | null;
}

const BOARD_PADDING = spacing.sm;
const CELL_GAP = spacing.xs;
const SWIPE_THRESHOLD = 30;

export function GameBoard({
  board,
  boardSize,
  onMove,
  direction,
}: GameBoardProps) {
  const theme = useTheme();
  const screenWidth = Dimensions.get("window").width;
  const boardWidth = screenWidth - spacing.base * 2;
  const cellSize =
    (boardWidth - BOARD_PADDING * 2 - CELL_GAP * (boardSize - 1)) / boardSize;

  const tiles = useAnimatedBoard(board, direction, boardSize);

  const boardDynamicStyle = useMemo(
    () => ({
      width: boardWidth,
      height: boardWidth,
      borderRadius: cellSize * 0.12,
      backgroundColor: theme.dark ? "#2A3A28" : "#6B8E63",
    }),
    [boardWidth, cellSize, theme.dark],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10,
        onPanResponderRelease: (_, gesture) => {
          const { dx, dy } = gesture;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;
          if (absDx > absDy) {
            onMove(dx > 0 ? "right" : "left");
          } else {
            onMove(dy > 0 ? "down" : "up");
          }
        },
      }),
    [onMove],
  );

  const bgCells = useMemo(() => {
    const cells = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const x = BOARD_PADDING + c * (cellSize + CELL_GAP);
        const y = BOARD_PADDING + r * (cellSize + CELL_GAP);
        cells.push(
          <View
            key={`bg-${r}-${c}`}
            style={[styles.bgCell, { left: x, top: y }]}
          >
            <GameTile value={0} size={cellSize} />
          </View>,
        );
      }
    }
    return cells;
  }, [boardSize, cellSize]);

  return (
    <View
      style={[styles.board, boardDynamicStyle]}
      testID="game-board"
      {...panResponder.panHandlers}
    >
      {bgCells}
      {tiles.map((tile) => (
        <AnimatedGameTile
          key={tile.key}
          tile={tile}
          cellSize={cellSize}
          cellGap={CELL_GAP}
          boardPadding={BOARD_PADDING}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {},
  bgCell: {
    position: "absolute",
  },
});
