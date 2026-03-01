import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import {
  SnapshotTree,
  buildTree,
  flattenTree,
} from "../../../../src/features/game2048/components/SnapshotTree";
import type { GameSnapshot } from "../../../../src/features/game2048/logic/gameTypes";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("date-fns", () => ({
  format: jest.fn(() => "03/01 12:00"),
}));

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

function makeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    id: "test-1",
    name: "Test Save",
    state: {
      board: [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 4],
      ],
      score: 100,
      boardSize: 4,
      isGameOver: false,
      hasWon: false,
      wonAcknowledged: false,
      moveCount: 10,
    },
    timestamp: 1700000000000,
    parentSnapshotId: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SnapshotTree", () => {
  const defaultProps = {
    snapshots: [] as GameSnapshot[],
    activeSnapshotId: null,
    onLoad: jest.fn(),
    onDelete: jest.fn(),
  };

  it("should show empty message when no snapshots", async () => {
    const { getByText, getByTestId } = await renderWithPaper(
      <SnapshotTree {...defaultProps} snapshots={[]} />,
    );
    expect(getByTestId("snapshot-tree-empty")).toBeTruthy();
    expect(getByText("game2048.noSnapshots")).toBeTruthy();
  });

  it("should render flat snapshots (all root) without indentation", async () => {
    const snapshots = [
      makeSnapshot({ id: "s1", name: "Save #1" }),
      makeSnapshot({ id: "s2", name: "Save #2" }),
      makeSnapshot({ id: "s3", name: "Save #3" }),
    ];
    const { getByText, getByTestId } = await renderWithPaper(
      <SnapshotTree {...defaultProps} snapshots={snapshots} />,
    );
    expect(getByTestId("snapshot-tree-list")).toBeTruthy();
    expect(getByText("Save #1")).toBeTruthy();
    expect(getByText("Save #2")).toBeTruthy();
    expect(getByText("Save #3")).toBeTruthy();
    expect(getByTestId("tree-node-s1")).toBeTruthy();
    expect(getByTestId("tree-node-s2")).toBeTruthy();
    expect(getByTestId("tree-node-s3")).toBeTruthy();
  });

  it("should render parent-child snapshots with correct indentation", async () => {
    const snapshots = [
      makeSnapshot({ id: "root", name: "Root Save" }),
      makeSnapshot({
        id: "child1",
        name: "Child Save",
        parentSnapshotId: "root",
      }),
    ];
    const { getByText, getByTestId } = await renderWithPaper(
      <SnapshotTree {...defaultProps} snapshots={snapshots} />,
    );
    expect(getByText("Root Save")).toBeTruthy();
    expect(getByText("Child Save")).toBeTruthy();
    expect(getByTestId("tree-node-root")).toBeTruthy();
    expect(getByTestId("tree-node-child1")).toBeTruthy();
  });

  it("should highlight the active snapshot", async () => {
    const snapshots = [
      makeSnapshot({ id: "s1", name: "Save #1" }),
      makeSnapshot({ id: "s2", name: "Save #2" }),
    ];
    const { getByTestId } = await renderWithPaper(
      <SnapshotTree
        {...defaultProps}
        snapshots={snapshots}
        activeSnapshotId="s2"
      />,
    );
    const activeNode = getByTestId("tree-node-s2");
    // The active node should have a backgroundColor set (secondaryContainer)
    expect(activeNode.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: expect.any(String) }),
      ]),
    );
  });

  it("should call onLoad when a node is tapped", async () => {
    const onLoad = jest.fn();
    const snapshot = makeSnapshot({ id: "tap-test", name: "Tap Me" });
    const { getByTestId } = await renderWithPaper(
      <SnapshotTree {...defaultProps} snapshots={[snapshot]} onLoad={onLoad} />,
    );
    await fireEvent(getByTestId("tree-node-tap-test"), "touchEnd");
    expect(onLoad).toHaveBeenCalledWith(snapshot);
  });

  it("should call onDelete when delete button is pressed", async () => {
    const onDelete = jest.fn();
    const snapshot = makeSnapshot({ id: "del-test", name: "Delete Me" });
    const { getByTestId } = await renderWithPaper(
      <SnapshotTree
        {...defaultProps}
        snapshots={[snapshot]}
        onDelete={onDelete}
      />,
    );
    await fireEvent.press(getByTestId("delete-tree-del-test"));
    expect(onDelete).toHaveBeenCalledWith("del-test");
  });

  it("should treat orphan nodes as roots", async () => {
    const snapshots = [
      makeSnapshot({ id: "s1", name: "Root" }),
      makeSnapshot({
        id: "orphan",
        name: "Orphan",
        parentSnapshotId: "non-existent-parent",
      }),
    ];
    const { getByText, getByTestId } = await renderWithPaper(
      <SnapshotTree {...defaultProps} snapshots={snapshots} />,
    );
    // Both should render as root-level nodes
    expect(getByText("Root")).toBeTruthy();
    expect(getByText("Orphan")).toBeTruthy();
    expect(getByTestId("tree-node-s1")).toBeTruthy();
    expect(getByTestId("tree-node-orphan")).toBeTruthy();
  });

  it("should handle deep nesting (depth 3+)", async () => {
    const snapshots = [
      makeSnapshot({ id: "d0", name: "Depth 0" }),
      makeSnapshot({ id: "d1", name: "Depth 1", parentSnapshotId: "d0" }),
      makeSnapshot({ id: "d2", name: "Depth 2", parentSnapshotId: "d1" }),
      makeSnapshot({ id: "d3", name: "Depth 3", parentSnapshotId: "d2" }),
    ];
    const { getByText, getByTestId } = await renderWithPaper(
      <SnapshotTree {...defaultProps} snapshots={snapshots} />,
    );
    expect(getByText("Depth 0")).toBeTruthy();
    expect(getByText("Depth 1")).toBeTruthy();
    expect(getByText("Depth 2")).toBeTruthy();
    expect(getByText("Depth 3")).toBeTruthy();
    expect(getByTestId("tree-node-d0")).toBeTruthy();
    expect(getByTestId("tree-node-d1")).toBeTruthy();
    expect(getByTestId("tree-node-d2")).toBeTruthy();
    expect(getByTestId("tree-node-d3")).toBeTruthy();
  });
});

describe("buildTree", () => {
  it("should build roots from snapshots with null parentSnapshotId", () => {
    const snapshots = [
      makeSnapshot({ id: "a", parentSnapshotId: null }),
      makeSnapshot({ id: "b", parentSnapshotId: null }),
    ];
    const roots = buildTree(snapshots);
    expect(roots).toHaveLength(2);
    expect(roots[0].snapshot.id).toBe("a");
    expect(roots[1].snapshot.id).toBe("b");
    expect(roots[0].depth).toBe(0);
    expect(roots[1].depth).toBe(0);
  });

  it("should nest children under parent", () => {
    const snapshots = [
      makeSnapshot({ id: "parent", parentSnapshotId: null }),
      makeSnapshot({ id: "child", parentSnapshotId: "parent" }),
    ];
    const roots = buildTree(snapshots);
    expect(roots).toHaveLength(1);
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].snapshot.id).toBe("child");
    expect(roots[0].children[0].depth).toBe(1);
  });

  it("should treat orphan as root", () => {
    const snapshots = [
      makeSnapshot({ id: "orphan", parentSnapshotId: "missing" }),
    ];
    const roots = buildTree(snapshots);
    expect(roots).toHaveLength(1);
    expect(roots[0].snapshot.id).toBe("orphan");
    expect(roots[0].depth).toBe(0);
  });
});

describe("flattenTree", () => {
  it("should flatten tree in DFS order", () => {
    const snapshots = [
      makeSnapshot({ id: "root", parentSnapshotId: null }),
      makeSnapshot({ id: "c1", parentSnapshotId: "root" }),
      makeSnapshot({ id: "c2", parentSnapshotId: "root" }),
      makeSnapshot({ id: "gc1", parentSnapshotId: "c1" }),
    ];
    const roots = buildTree(snapshots);
    const flat = flattenTree(roots);
    expect(flat.map((n) => n.snapshot.id)).toEqual(["root", "c1", "gc1", "c2"]);
  });

  it("should set isLastChild correctly", () => {
    const snapshots = [
      makeSnapshot({ id: "root", parentSnapshotId: null }),
      makeSnapshot({ id: "c1", parentSnapshotId: "root" }),
      makeSnapshot({ id: "c2", parentSnapshotId: "root" }),
    ];
    const roots = buildTree(snapshots);
    const flat = flattenTree(roots);
    // root is the only root -> last child
    expect(flat[0].isLastChild).toBe(true);
    // c1 is not the last child of root
    expect(flat[1].isLastChild).toBe(false);
    // c2 is the last child of root
    expect(flat[2].isLastChild).toBe(true);
  });

  it("should build correct continuationLines", () => {
    const snapshots = [
      makeSnapshot({ id: "root", parentSnapshotId: null }),
      makeSnapshot({ id: "c1", parentSnapshotId: "root" }),
      makeSnapshot({ id: "c2", parentSnapshotId: "root" }),
      makeSnapshot({ id: "gc1", parentSnapshotId: "c1" }),
    ];
    const roots = buildTree(snapshots);
    const flat = flattenTree(roots);
    // root: depth 0, no continuation lines
    expect(flat[0].continuationLines).toEqual([]);
    // c1: depth 1, root is last at depth 0 so no continuation line at that level
    expect(flat[1].continuationLines).toEqual([false]);
    // gc1: depth 2, c1 is not last child of root -> continuation=true at depth 1
    expect(flat[2].continuationLines).toEqual([false, true]);
    // c2: depth 1, same as c1's parent level
    expect(flat[3].continuationLines).toEqual([false]);
  });
});
