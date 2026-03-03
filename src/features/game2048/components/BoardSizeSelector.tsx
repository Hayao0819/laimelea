import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import type { BoardSize } from "../logic/gameTypes";

interface BoardSizeSelectorProps {
  size: BoardSize;
  onSizeChange: (size: BoardSize) => void;
}

export function BoardSizeSelector({
  size,
  onSizeChange,
}: BoardSizeSelectorProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container} testID="board-size-selector">
      <Text variant="labelMedium" style={styles.label}>
        {t("game2048.boardSize")}
      </Text>
      <SegmentedButtons
        value={String(size)}
        onValueChange={(v) => onSizeChange(Number(v) as BoardSize)}
        buttons={[
          { value: "3", label: "3\u00d73" },
          { value: "4", label: "4\u00d74" },
          { value: "5", label: "5\u00d75" },
          { value: "6", label: "6\u00d76" },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  label: {
    marginBottom: spacing.sm,
  },
});
