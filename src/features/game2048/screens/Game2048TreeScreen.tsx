import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import {
  activeSnapshotIdAtom,
  deleteSnapshotAtom,
  game2048HydratedAtom,
  loadSnapshotAtom,
  snapshotsAtom,
} from "../atoms/game2048Atoms";
import { SnapshotTree } from "../components/SnapshotTree";
import type { GameSnapshot } from "../logic/gameTypes";

export function Game2048TreeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const snapshots = useAtomValue(snapshotsAtom);
  const gameHydrated = useAtomValue(game2048HydratedAtom);
  const activeSnapshotId = useAtomValue(activeSnapshotIdAtom);
  const loadSnapshot = useSetAtom(loadSnapshotAtom);
  const deleteSnapshot = useSetAtom(deleteSnapshotAtom);

  const handleLoad = useCallback(
    (snapshot: GameSnapshot) => {
      loadSnapshot(snapshot);
    },
    [loadSnapshot],
  );

  const handleDelete = useCallback(
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
          paddingRight: spacing.base + insets.right,
          paddingBottom: spacing.base + insets.bottom,
          paddingLeft: spacing.base + insets.left,
        },
      ]}
      testID="game-2048-tree-screen"
    >
      <Text variant="titleLarge" style={styles.title}>
        {t("game2048.snapshotTree")}
      </Text>
      <SnapshotTree
        snapshots={snapshots}
        activeSnapshotId={activeSnapshotId}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.base,
  },
  title: {
    marginBottom: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
