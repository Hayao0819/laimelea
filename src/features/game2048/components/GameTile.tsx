import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type TileColor = { bg: string; text: string };

const LIGHT_TILE_COLORS: Record<number, TileColor> = {
  0: { bg: "rgba(203, 232, 193, 0.35)", text: "transparent" },
  2: { bg: "#E8F0E5", text: "#1A1C19" },
  4: { bg: "#D5E8CF", text: "#1A1C19" },
  8: { bg: "#C0DEBA", text: "#1A1C19" },
  16: { bg: "#A0CC90", text: "#FFFFFF" },
  32: { bg: "#7FBE6F", text: "#FFFFFF" },
  64: { bg: "#5AA34E", text: "#FFFFFF" },
  128: { bg: "#4A6741", text: "#FFFFFF" },
  256: { bg: "#3D7E6A", text: "#FFFFFF" },
  512: { bg: "#39656B", text: "#FFFFFF" },
  1024: { bg: "#2B5048", text: "#FFFFFF" },
  2048: { bg: "#1D3613", text: "#FFFFFF" },
};

const DARK_TILE_COLORS: Record<number, TileColor> = {
  0: { bg: "rgba(51, 77, 43, 0.35)", text: "transparent" },
  2: { bg: "#2A3528", text: "#E2E3DC" },
  4: { bg: "#334D2B", text: "#E2E3DC" },
  8: { bg: "#3E5C35", text: "#E2E3DC" },
  16: { bg: "#4F7244", text: "#FFFFFF" },
  32: { bg: "#608856", text: "#FFFFFF" },
  64: { bg: "#78A86C", text: "#FFFFFF" },
  128: { bg: "#8EC284", text: "#1A1C19" },
  256: { bg: "#4E8E8A", text: "#FFFFFF" },
  512: { bg: "#6BAFAA", text: "#1A1C19" },
  1024: { bg: "#89C9C0", text: "#1A1C19" },
  2048: { bg: "#A1CED5", text: "#1A1C19" },
};

const LIGHT_DEFAULT: TileColor = { bg: "#072100", text: "#FFFFFF" };
const DARK_DEFAULT: TileColor = { bg: "#CBE8C1", text: "#1A1C19" };

interface GameTileProps {
  value: number;
  size: number;
}

export const GameTile = memo(function GameTile({ value, size }: GameTileProps) {
  const theme = useTheme();
  const palette = theme.dark ? DARK_TILE_COLORS : LIGHT_TILE_COLORS;
  const fallback = theme.dark ? DARK_DEFAULT : LIGHT_DEFAULT;
  const colors = palette[value] ?? fallback;
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
