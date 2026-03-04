import { format } from "date-fns";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import type { GameSnapshot } from "../logic/gameTypes";

interface TreeNode {
  snapshot: GameSnapshot;
  children: TreeNode[];
  depth: number;
}

interface FlatTreeNode {
  snapshot: GameSnapshot;
  depth: number;
  isLastChild: boolean;
  /** For each ancestor depth, whether a vertical continuation line is needed. */
  continuationLines: boolean[];
}

interface SnapshotTreeProps {
  snapshots: GameSnapshot[];
  activeSnapshotId: string | null;
  onLoad: (snapshot: GameSnapshot) => void;
  onDelete: (snapshotId: string) => void;
}

const INDENT_PER_DEPTH = 24;

function buildTree(snapshots: GameSnapshot[]): TreeNode[] {
  const childrenMap = new Map<string | null, GameSnapshot[]>();
  const idSet = new Set(snapshots.map((s) => s.id));

  for (const snapshot of snapshots) {
    // Orphan nodes (parent not found) are treated as roots
    const parentId =
      snapshot.parentSnapshotId !== null && idSet.has(snapshot.parentSnapshotId)
        ? snapshot.parentSnapshotId
        : null;
    const existing = childrenMap.get(parentId) ?? [];
    existing.push(snapshot);
    childrenMap.set(parentId, existing);
  }

  function buildNodes(parentId: string | null, depth: number): TreeNode[] {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((snapshot) => ({
      snapshot,
      children: buildNodes(snapshot.id, depth + 1),
      depth,
    }));
  }

  return buildNodes(null, 0);
}

function flattenTree(roots: TreeNode[]): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  function traverse(nodes: TreeNode[], continuationLines: boolean[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLast = i === nodes.length - 1;
      const flatNode: FlatTreeNode = {
        snapshot: node.snapshot,
        depth: node.depth,
        isLastChild: isLast,
        continuationLines: [...continuationLines],
      };
      result.push(flatNode);
      traverse(node.children, [...continuationLines, !isLast]);
    }
  }

  traverse(roots, []);
  return result;
}

function TreeNodeRow({
  item,
  isActive,
  onLoad,
  onDelete,
}: {
  item: FlatTreeNode;
  isActive: boolean;
  onLoad: (snapshot: GameSnapshot) => void;
  onDelete: (snapshotId: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { snapshot, depth, isLastChild, continuationLines } = item;

  const connector = isLastChild ? "\u2514\u2500 " : "\u251C\u2500 ";
  const prefix = continuationLines
    .map((hasContinuation) => (hasContinuation ? "\u2502  " : "   "))
    .join("");
  const treePrefix = depth > 0 ? prefix + connector : "";

  const description = `${t("game2048.score")}: ${snapshot.state.score} \u00b7 ${format(new Date(snapshot.timestamp), "MM/dd HH:mm")} \u00b7 ${snapshot.state.boardSize}\u00d7${snapshot.state.boardSize}`;

  return (
    <View
      style={[
        styles.nodeRow,
        isActive && { backgroundColor: theme.colors.secondaryContainer },
      ]}
      testID={`tree-node-${snapshot.id}`}
      accessible
      accessibilityRole="button"
      onTouchEnd={() => onLoad(snapshot)}
    >
      <View
        style={[styles.nodeContent, { paddingLeft: depth * INDENT_PER_DEPTH }]}
      >
        {depth > 0 && (
          <Text style={[styles.connector, { color: theme.colors.outline }]}>
            {treePrefix}
          </Text>
        )}
        <View style={styles.nodeInfo}>
          <Text
            variant="bodyMedium"
            style={isActive ? styles.activeNodeName : undefined}
            numberOfLines={1}
          >
            {snapshot.name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
            numberOfLines={1}
          >
            {description}
          </Text>
        </View>
      </View>
      <IconButton
        icon="delete"
        onPress={() => onDelete(snapshot.id)}
        size={20}
        testID={`delete-tree-${snapshot.id}`}
      />
    </View>
  );
}

export function SnapshotTree({
  snapshots,
  activeSnapshotId,
  onLoad,
  onDelete,
}: SnapshotTreeProps) {
  const { t } = useTranslation();

  const flatNodes = useMemo(() => {
    const roots = buildTree(snapshots);
    return flattenTree(roots);
  }, [snapshots]);

  const renderItem = useCallback(
    ({ item }: { item: FlatTreeNode }) => (
      <TreeNodeRow
        item={item}
        isActive={item.snapshot.id === activeSnapshotId}
        onLoad={onLoad}
        onDelete={onDelete}
      />
    ),
    [activeSnapshotId, onLoad, onDelete],
  );

  const keyExtractor = useCallback(
    (item: FlatTreeNode) => item.snapshot.id,
    [],
  );

  if (snapshots.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="snapshot-tree-empty">
        <Text>{t("game2048.noSnapshots")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={flatNodes}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      testID="snapshot-tree-list"
    />
  );
}

// Exported for testing
export { buildTree, flattenTree };
export type { FlatTreeNode, SnapshotTreeProps, TreeNode };

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
  },
  nodeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
  },
  connector: {
    fontFamily: "monospace",
    fontSize: 14,
  },
  nodeInfo: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  activeNodeName: {
    fontWeight: "bold",
  },
});
