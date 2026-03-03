import {
  computeMoveAnimation,
  initTilesFromBoard,
  resetIdCounter,
  slideRowTracked,
  type TrackedTile,
  trackMove,
} from "../../../../src/features/game2048/logic/tileTracker";

beforeEach(() => {
  resetIdCounter(1);
});

function makeTile(
  id: number,
  value: number,
  row: number,
  col: number,
): TrackedTile {
  return { id, value, row, col };
}

describe("slideRowTracked", () => {
  it("handles empty row", () => {
    const { cells, animations, mergedIds } = slideRowTracked([
      null,
      null,
      null,
      null,
    ]);
    expect(cells).toEqual([null, null, null, null]);
    expect(animations).toHaveLength(0);
    expect(mergedIds.size).toBe(0);
  });

  it("no movement needed", () => {
    const t = makeTile(1, 2, 0, 0);
    const { cells, animations } = slideRowTracked([t, null, null, null]);
    expect(cells[0]?.id).toBe(1);
    expect(cells[0]?.value).toBe(2);
    expect(animations).toHaveLength(0);
  });

  it("slides tile to the left", () => {
    const t = makeTile(1, 4, 0, 2);
    const { cells, animations } = slideRowTracked([null, null, t, null]);
    expect(cells[0]?.value).toBe(4);
    expect(cells[0]?.id).toBe(1);
    expect(cells[1]).toBeNull();
    expect(animations).toHaveLength(1);
    expect(animations[0]).toMatchObject({
      tileId: 1,
      fromCol: 2,
      toCol: 0,
      type: "slide",
    });
  });

  it("merges two equal tiles", () => {
    const a = makeTile(1, 2, 0, 0);
    const b = makeTile(2, 2, 0, 1);
    const { cells, animations, mergedIds } = slideRowTracked([
      a,
      b,
      null,
      null,
    ]);
    expect(cells[0]?.value).toBe(4);
    expect(mergedIds.has(cells[0]!.id)).toBe(true);
    expect(cells[1]).toBeNull();
    expect(animations).toHaveLength(2);
    expect(animations.every((m) => m.type === "merge-source")).toBe(true);
  });

  it("merges only first pair (2,2,2 -> 4,2)", () => {
    const a = makeTile(1, 2, 0, 0);
    const b = makeTile(2, 2, 0, 1);
    const c = makeTile(3, 2, 0, 2);
    const { cells } = slideRowTracked([a, b, c, null]);
    expect(cells[0]?.value).toBe(4);
    expect(cells[1]?.value).toBe(2);
    expect(cells[1]?.id).toBe(3);
    expect(cells[2]).toBeNull();
  });

  it("merges two separate pairs (2,2,4,4 -> 4,8)", () => {
    const a = makeTile(1, 2, 0, 0);
    const b = makeTile(2, 2, 0, 1);
    const c = makeTile(3, 4, 0, 2);
    const d = makeTile(4, 4, 0, 3);
    const { cells, mergedIds } = slideRowTracked([a, b, c, d]);
    expect(cells[0]?.value).toBe(4);
    expect(cells[1]?.value).toBe(8);
    expect(cells[2]).toBeNull();
    expect(cells[3]).toBeNull();
    expect(mergedIds.size).toBe(2);
  });

  it("slides tiles with gap", () => {
    const a = makeTile(1, 2, 0, 0);
    const b = makeTile(2, 4, 0, 3);
    const { cells, animations } = slideRowTracked([a, null, null, b]);
    expect(cells[0]?.id).toBe(1);
    expect(cells[1]?.id).toBe(2);
    expect(cells[1]?.col).toBe(1);
    expect(animations).toHaveLength(1);
    expect(animations[0]).toMatchObject({ tileId: 2, fromCol: 3, toCol: 1 });
  });
});

describe("computeMoveAnimation", () => {
  it("slides left correctly", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 2), makeTile(2, 4, 1, 3)];
    const { moves, resultTiles } = computeMoveAnimation(tiles, "left", 4);

    const t1 = resultTiles.find((t) => t.id === 1);
    const t2 = resultTiles.find((t) => t.id === 2);
    expect(t1).toMatchObject({ row: 0, col: 0 });
    expect(t2).toMatchObject({ row: 1, col: 0 });
    expect(moves).toHaveLength(2);
  });

  it("slides right correctly", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 1), makeTile(2, 4, 1, 0)];
    const { resultTiles } = computeMoveAnimation(tiles, "right", 4);

    const t1 = resultTiles.find((t) => t.id === 1);
    const t2 = resultTiles.find((t) => t.id === 2);
    expect(t1).toMatchObject({ row: 0, col: 3 });
    expect(t2).toMatchObject({ row: 1, col: 3 });
  });

  it("slides up correctly", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 2, 0), makeTile(2, 4, 3, 1)];
    const { resultTiles } = computeMoveAnimation(tiles, "up", 4);

    const t1 = resultTiles.find((t) => t.id === 1);
    const t2 = resultTiles.find((t) => t.id === 2);
    expect(t1).toMatchObject({ row: 0, col: 0 });
    expect(t2).toMatchObject({ row: 0, col: 1 });
  });

  it("slides down correctly", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 4, 1, 1)];
    const { resultTiles } = computeMoveAnimation(tiles, "down", 4);

    const t1 = resultTiles.find((t) => t.id === 1);
    const t2 = resultTiles.find((t) => t.id === 2);
    expect(t1).toMatchObject({ row: 3, col: 0 });
    expect(t2).toMatchObject({ row: 3, col: 1 });
  });

  it("merges tiles when sliding left", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 2, 0, 1)];
    const { resultTiles, mergedIds, moves } = computeMoveAnimation(
      tiles,
      "left",
      4,
    );

    expect(resultTiles).toHaveLength(1);
    expect(resultTiles[0].value).toBe(4);
    expect(mergedIds.has(resultTiles[0].id)).toBe(true);
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.type === "merge-source")).toBe(true);
  });

  it("handles empty tiles array", () => {
    const { moves, resultTiles, mergedIds } = computeMoveAnimation(
      [],
      "left",
      4,
    );
    expect(moves).toHaveLength(0);
    expect(resultTiles).toHaveLength(0);
    expect(mergedIds.size).toBe(0);
  });
});

describe("initTilesFromBoard", () => {
  it("creates tiles for non-zero cells", () => {
    const board = [
      [2, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 8],
    ];
    const tiles = initTilesFromBoard(board);
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toMatchObject({ value: 2, row: 0, col: 0 });
    expect(tiles[1]).toMatchObject({ value: 4, row: 1, col: 1 });
    expect(tiles[2]).toMatchObject({ value: 8, row: 3, col: 3 });
  });

  it("assigns unique ids", () => {
    const board = [
      [2, 4],
      [8, 16],
    ];
    const tiles = initTilesFromBoard(board);
    const ids = tiles.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns empty for empty board", () => {
    const board = [
      [0, 0],
      [0, 0],
    ];
    expect(initTilesFromBoard(board)).toHaveLength(0);
  });
});

describe("trackMove", () => {
  it("detects spawned tile", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 4, 0, 1)];
    const newBoard = [
      [2, 4, 0, 0],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    expect(result.spawnedId).not.toBeNull();
    const spawned = result.tiles.find((t) => t.id === result.spawnedId);
    expect(spawned).toMatchObject({ value: 2, row: 1, col: 3 });
  });

  it("preserves tile IDs across simple slide", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 2)];
    const newBoard = [
      [2, 0, 0, 0],
      [0, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    const original = result.tiles.find((t) => t.id === 1);
    expect(original).toMatchObject({ value: 2, row: 0, col: 0 });
    expect(result.animations).toHaveLength(1);
    expect(result.animations[0]).toMatchObject({
      tileId: 1,
      fromCol: 2,
      toCol: 0,
    });
  });

  it("creates new IDs for merged tiles", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 2, 0, 1)];
    const newBoard = [
      [4, 0, 0, 0],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    expect(result.mergedIds.size).toBe(1);
    const mergedTile = result.tiles.find((t) => result.mergedIds.has(t.id));
    expect(mergedTile?.value).toBe(4);
    expect(result.tiles.find((t) => t.id === 1)).toBeUndefined();
    expect(result.tiles.find((t) => t.id === 2)).toBeUndefined();
  });

  it("handles no-spawn scenario (board full after merge)", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 2, 0, 1)];
    const newBoard = [
      [4, 0],
      [0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    expect(result.spawnedId).toBeNull();
  });
});

describe("trackMove validation", () => {
  it("falls back to initTilesFromBoard when tracker diverges from board", () => {
    resetIdCounter(1);
    const divergedTiles = [makeTile(1, 2, 0, 0)];
    const newBoard = [
      [4, 0, 0, 0],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(divergedTiles, newBoard, "left");
    expect(result.animations).toHaveLength(0);
    expect(result.mergedIds.size).toBe(0);
    expect(result.spawnedId).toBeNull();
    expect(result.tiles).toHaveLength(2);
    const values = result.tiles.map((t) => t.value).sort((a, b) => a - b);
    expect(values).toEqual([2, 4]);
  });

  it("works normally when tracker state is consistent", () => {
    resetIdCounter(100);
    const tiles = [makeTile(1, 2, 0, 2)];
    const newBoard = [
      [2, 0, 0, 0],
      [0, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    expect(result.animations.length).toBeGreaterThan(0);
    expect(result.tiles.find((t) => t.id === 1)).toMatchObject({
      row: 0,
      col: 0,
    });
  });

  it("falls back when tile count diverges too much from board", () => {
    resetIdCounter(1);
    const tiles = [
      makeTile(1, 2, 0, 0),
      makeTile(2, 4, 0, 1),
      makeTile(3, 8, 0, 2),
    ];
    const newBoard = [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    expect(result.animations).toHaveLength(0);
    expect(result.mergedIds.size).toBe(0);
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].value).toBe(2);
  });

  it("falls back when result tiles have wrong positions after merge", () => {
    resetIdCounter(1);
    // Tracker has two 2s on row 0 that will merge to 4 at (0,0),
    // but newBoard has 8 at (0,0) — impossible mismatch
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 2, 0, 1)];
    const newBoard = [
      [8, 0, 0, 0],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = trackMove(tiles, newBoard, "left");
    expect(result.animations).toHaveLength(0);
    expect(result.mergedIds.size).toBe(0);
    expect(result.tiles).toHaveLength(2);
    const values = result.tiles.map((t) => t.value).sort((a, b) => a - b);
    expect(values).toEqual([2, 8]);
  });
});
