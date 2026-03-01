import React, { useMemo } from "react";
import { Dimensions, PanResponder, StyleSheet, View } from "react-native";
import { GameTile } from "./GameTile";
import type { Direction } from "../logic/gameTypes";
import { spacing } from "../../../app/spacing";

interface GameBoardProps {
  board: number[][];
  boardSize: number;
  onMove: (direction: Direction) => void;
}

const BOARD_PADDING = spacing.sm;
const CELL_GAP = spacing.xs;
const SWIPE_THRESHOLD = 30;

export function GameBoard({ board, boardSize, onMove }: GameBoardProps) {
  const screenWidth = Dimensions.get("window").width;
  const boardWidth = screenWidth - spacing.base * 2;
  const cellSize =
    (boardWidth - BOARD_PADDING * 2 - CELL_GAP * (boardSize - 1)) / boardSize;

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

  return (
    <View
      style={[
        styles.board,
        {
          width: boardWidth,
          height: boardWidth,
          borderRadius: cellSize * 0.12,
          padding: BOARD_PADDING,
        },
      ]}
      testID="game-board"
      {...panResponder.panHandlers}
    >
      <View style={styles.grid}>
        {board.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((val, c) => (
              <View
                key={`${r}-${c}`}
                style={
                  c > 0
                    ? { marginLeft: CELL_GAP }
                    : undefined
                }
              >
                <GameTile value={val} size={cellSize} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: "#bbada0",
  },
  grid: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
  },
});
