import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import {
  activeSnapshotIdAtom,
  game2048StoreAtom,
  loadSnapshotAtom,
  resolvedStoreAtom,
  snapshotsAtom,
} from "../atoms/game2048Atoms";
import { SnapshotTree } from "../components/SnapshotTree";
import type { GameSnapshot } from "../logic/gameTypes";

export function Game2048TreeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const snapshots = useAtomValue(snapshotsAtom);
  const activeSnapshotId = useAtomValue(activeSnapshotIdAtom);
  const loadSnapshot = useSetAtom(loadSnapshotAtom);
  const setStore = useSetAtom(game2048StoreAtom);
  const store = useAtomValue(resolvedStoreAtom);

  const handleLoad = useCallback(
    (snapshot: GameSnapshot) => {
      loadSnapshot(snapshot);
    },
    [loadSnapshot],
  );

  const handleDelete = useCallback(
    (snapshotId: string) => {
      setStore({
        ...store,
        snapshots: store.snapshots.filter((s) => s.id !== snapshotId),
        activeSnapshotId:
          store.activeSnapshotId === snapshotId ? null : store.activeSnapshotId,
      });
    },
    [store, setStore],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
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
});
