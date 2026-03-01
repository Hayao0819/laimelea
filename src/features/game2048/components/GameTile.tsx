import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: "rgba(238, 228, 218, 0.35)", text: "transparent" },
  2: { bg: "#eee4da", text: "#776e65" },
  4: { bg: "#ede0c8", text: "#776e65" },
  8: { bg: "#f2b179", text: "#f9f6f2" },
  16: { bg: "#f59563", text: "#f9f6f2" },
  32: { bg: "#f67c5f", text: "#f9f6f2" },
  64: { bg: "#f65e3b", text: "#f9f6f2" },
  128: { bg: "#edcf72", text: "#f9f6f2" },
  256: { bg: "#edcc61", text: "#f9f6f2" },
  512: { bg: "#edc850", text: "#f9f6f2" },
  1024: { bg: "#edc53f", text: "#f9f6f2" },
  2048: { bg: "#edc22e", text: "#f9f6f2" },
};

const DEFAULT_COLORS = { bg: "#3c3a32", text: "#f9f6f2" };

interface GameTileProps {
  value: number;
  size: number;
}

export const GameTile = memo(function GameTile({ value, size }: GameTileProps) {
  const colors = TILE_COLORS[value] ?? DEFAULT_COLORS;
  const fontSize =
    value >= 1000 ? size * 0.25 : value >= 100 ? size * 0.3 : size * 0.4;

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: colors.bg,
          borderRadius: size * 0.08,
        },
      ]}
      testID={`tile-${value}`}
    >
      {value > 0 && (
        <Text
          style={[styles.text, { color: colors.text, fontSize }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontWeight: "bold",
  },
});
