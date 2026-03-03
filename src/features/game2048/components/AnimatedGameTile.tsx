import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { TileRenderData } from "../hooks/useAnimatedBoard";
import { GameTile } from "./GameTile";

const SLIDE_DURATION = 120;
const MERGE_POP_DURATION = 160;
const SPAWN_POP_DURATION = 160;

interface AnimatedGameTileProps {
  tile: TileRenderData;
  cellSize: number;
  cellGap: number;
  boardPadding: number;
}

function cellToPixel(
  index: number,
  cellSize: number,
  cellGap: number,
  boardPadding: number,
): number {
  return boardPadding + index * (cellSize + cellGap);
}

export function AnimatedGameTile({
  tile,
  cellSize,
  cellGap,
  boardPadding,
}: AnimatedGameTileProps) {
  const targetX = cellToPixel(tile.col, cellSize, cellGap, boardPadding);
  const targetY = cellToPixel(tile.row, cellSize, cellGap, boardPadding);
  const startX = cellToPixel(tile.fromCol, cellSize, cellGap, boardPadding);
  const startY = cellToPixel(tile.fromRow, cellSize, cellGap, boardPadding);

  const x = useSharedValue(startX);
  const y = useSharedValue(startY);
  const scale = useSharedValue(tile.animationType === "spawn" ? 0 : 1);

  useEffect(() => {
    const timingConfig = {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.ease),
    };

    switch (tile.animationType) {
      case "slide":
        x.value = startX;
        y.value = startY;
        x.value = withTiming(targetX, timingConfig);
        y.value = withTiming(targetY, timingConfig);
        break;

      case "merge":
        x.value = startX;
        y.value = startY;
        x.value = withTiming(targetX, timingConfig);
        y.value = withTiming(targetY, timingConfig);
        scale.value = withDelay(
          SLIDE_DURATION,
          withSequence(
            withTiming(1.15, { duration: MERGE_POP_DURATION * 0.5 }),
            withTiming(1, { duration: MERGE_POP_DURATION * 0.5 }),
          ),
        );
        break;

      case "spawn":
        x.value = targetX;
        y.value = targetY;
        scale.value = withDelay(
          SLIDE_DURATION,
          withSequence(
            withTiming(1.1, { duration: SPAWN_POP_DURATION * 0.6 }),
            withTiming(1, { duration: SPAWN_POP_DURATION * 0.4 }),
          ),
        );
        break;

      case "none":
        x.value = targetX;
        y.value = targetY;
        scale.value = 1;
        break;
    }
  }, [tile.key, tile.animationType, targetX, targetY, startX, startY, x, y, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.tileWrapper, animatedStyle]}>
      <GameTile value={tile.value} size={cellSize} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tileWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
