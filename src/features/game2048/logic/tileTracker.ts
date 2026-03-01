import type { Direction } from "./gameTypes";

let nextId = 1;

export function resetIdCounter(start = 1): void {
  nextId = start;
}

function allocId(): number {
  return nextId++;
}

export interface TrackedTile {
  id: number;
  value: number;
  row: number;
  col: number;
}

export interface TileAnimation {
  tileId: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  type: "slide" | "merge-source";
}

export interface MoveAnimation {
  moves: TileAnimation[];
  resultTiles: TrackedTile[];
  mergedIds: Set<number>;
}

export function initTilesFromBoard(board: number[][]): TrackedTile[] {
  const tiles: TrackedTile[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] !== 0) {
        tiles.push({ id: allocId(), value: board[r][c], row: r, col: c });
      }
    }
  }
  return tiles;
}

export interface SlideRowResult {
  cells: (TrackedTile | null)[];
  animations: TileAnimation[];
  mergedIds: Set<number>;
}

export function slideRowTracked(cells: (TrackedTile | null)[]): SlideRowResult {
  const size = cells.length;
  const nonNull: TrackedTile[] = cells.filter(
    (c): c is TrackedTile => c !== null,
  );

  const result: (TrackedTile | null)[] = Array(size).fill(null);
  const animations: TileAnimation[] = [];
  const mergedIds = new Set<number>();

  let pos = 0;
  let i = 0;
  while (i < nonNull.length) {
    const tile = nonNull[i];
    if (i + 1 < nonNull.length && nonNull[i].value === nonNull[i + 1].value) {
      const other = nonNull[i + 1];
      const mergedValue = tile.value * 2;
      const newTile: TrackedTile = {
        id: allocId(),
        value: mergedValue,
        row: tile.row,
        col: pos,
      };
      result[pos] = newTile;
      mergedIds.add(newTile.id);

      animations.push({
        tileId: tile.id,
        fromRow: tile.row,
        fromCol: tile.col,
        toRow: tile.row,
        toCol: pos,
        type: "merge-source",
      });
      animations.push({
        tileId: other.id,
        fromRow: other.row,
        fromCol: other.col,
        toRow: other.row,
        toCol: pos,
        type: "merge-source",
      });

      i += 2;
    } else {
      const movedTile: TrackedTile = {
        ...tile,
        col: pos,
      };
      result[pos] = movedTile;

      if (pos !== tile.col) {
        animations.push({
          tileId: tile.id,
          fromRow: tile.row,
          fromCol: tile.col,
          toRow: tile.row,
          toCol: pos,
          type: "slide",
        });
      }

      i += 1;
    }
    pos++;
  }

  return { cells: result, animations, mergedIds };
}

function tilesToRowCells(
  tiles: TrackedTile[],
  row: number,
  size: number,
): (TrackedTile | null)[] {
  const cells: (TrackedTile | null)[] = Array(size).fill(null);
  for (const t of tiles) {
    if (t.row === row) {
      cells[t.col] = t;
    }
  }
  return cells;
}

function transformToLeft(
  tiles: TrackedTile[],
  direction: Direction,
  size: number,
): TrackedTile[] {
  return tiles.map((t) => {
    switch (direction) {
      case "left":
        return t;
      case "right":
        return { ...t, col: size - 1 - t.col };
      case "up":
        return { ...t, row: t.col, col: t.row };
      case "down":
        return { ...t, row: t.col, col: size - 1 - t.row };
    }
  });
}

function transformFromLeft(
  tiles: TrackedTile[],
  direction: Direction,
  size: number,
): TrackedTile[] {
  return tiles.map((t) => {
    switch (direction) {
      case "left":
        return t;
      case "right":
        return { ...t, col: size - 1 - t.col };
      case "up":
        return { ...t, row: t.col, col: t.row };
      case "down":
        return { ...t, row: size - 1 - t.col, col: t.row };
    }
  });
}

function transformAnimFromLeft(
  anims: TileAnimation[],
  direction: Direction,
  size: number,
): TileAnimation[] {
  return anims.map((a) => {
    switch (direction) {
      case "left":
        return a;
      case "right":
        return {
          ...a,
          fromCol: size - 1 - a.fromCol,
          toCol: size - 1 - a.toCol,
        };
      case "up":
        return {
          ...a,
          fromRow: a.fromCol,
          fromCol: a.fromRow,
          toRow: a.toCol,
          toCol: a.toRow,
        };
      case "down":
        return {
          ...a,
          fromRow: size - 1 - a.fromCol,
          fromCol: a.fromRow,
          toRow: size - 1 - a.toCol,
          toCol: a.toRow,
        };
    }
  });
}

export function computeMoveAnimation(
  tiles: TrackedTile[],
  direction: Direction,
  size: number,
): MoveAnimation {
  if (tiles.length === 0) {
    return { moves: [], resultTiles: [], mergedIds: new Set() };
  }
  const transformed = transformToLeft(tiles, direction, size);

  const allAnimations: TileAnimation[] = [];
  const allResult: TrackedTile[] = [];
  const allMerged = new Set<number>();

  for (let row = 0; row < size; row++) {
    const rowCells = tilesToRowCells(transformed, row, size);
    const { cells, animations, mergedIds } = slideRowTracked(rowCells);

    for (const a of animations) {
      allAnimations.push(a);
    }
    for (const id of mergedIds) {
      allMerged.add(id);
    }
    for (const cell of cells) {
      if (cell !== null) {
        allResult.push(cell);
      }
    }
  }

  const resultTiles = transformFromLeft(allResult, direction, size);
  const moves = transformAnimFromLeft(allAnimations, direction, size);

  return { moves, resultTiles, mergedIds: allMerged };
}

export function trackMove(
  currentTiles: TrackedTile[],
  newBoard: number[][],
  direction: Direction,
  size?: number,
): {
  tiles: TrackedTile[];
  animations: TileAnimation[];
  mergedIds: Set<number>;
  spawnedId: number | null;
} {
  const boardSize = size ?? newBoard.length;
  const { moves, resultTiles, mergedIds } = computeMoveAnimation(
    currentTiles,
    direction,
    boardSize,
  );

  const occupied = new Set(resultTiles.map((t) => `${t.row},${t.col}`));
  let spawnedId: number | null = null;

  const finalTiles = [...resultTiles];
  for (let r = 0; r < newBoard.length; r++) {
    for (let c = 0; c < newBoard[r].length; c++) {
      if (newBoard[r][c] !== 0 && !occupied.has(`${r},${c}`)) {
        const tile: TrackedTile = {
          id: allocId(),
          value: newBoard[r][c],
          row: r,
          col: c,
        };
        finalTiles.push(tile);
        spawnedId = tile.id;
      }
    }
  }

  return { tiles: finalTiles, animations: moves, mergedIds, spawnedId };
}
