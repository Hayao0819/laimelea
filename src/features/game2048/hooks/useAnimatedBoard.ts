import { useRef } from "react";
import type { Direction } from "../logic/gameTypes";
import {
  initTilesFromBoard,
  trackMove,
  type TrackedTile,
} from "../logic/tileTracker";

export interface TileRenderData {
  key: number;
  value: number;
  row: number;
  col: number;
  fromRow: number;
  fromCol: number;
  animationType: "none" | "slide" | "merge" | "spawn";
}

export function useAnimatedBoard(
  board: number[][],
  direction: Direction | null,
  boardSize: number,
): TileRenderData[] {
  const tilesRef = useRef<TrackedTile[]>([]);
  const isFirstRender = useRef(true);
  const resultRef = useRef<TileRenderData[]>([]);
  const prevBoardRef = useRef<number[][] | null>(null);

  // We compute synchronously so the returned array is ready for render.
  // Using a ref + manual comparison avoids extra re-renders.

  if (isFirstRender.current) {
    isFirstRender.current = false;
    const tiles = initTilesFromBoard(board);
    tilesRef.current = tiles;
    prevBoardRef.current = board;
    resultRef.current = tiles.map((t) => ({
      key: t.id,
      value: t.value,
      row: t.row,
      col: t.col,
      fromRow: t.row,
      fromCol: t.col,
      animationType: "none" as const,
    }));
    return resultRef.current;
  }

  if (!direction) {
    // Board changed without direction (new game, undo, load)
    const tiles = initTilesFromBoard(board);
    tilesRef.current = tiles;
    prevBoardRef.current = board;
    resultRef.current = tiles.map((t) => ({
      key: t.id,
      value: t.value,
      row: t.row,
      col: t.col,
      fromRow: t.row,
      fromCol: t.col,
      animationType: "none" as const,
    }));
    return resultRef.current;
  }

  if (board === prevBoardRef.current) {
    return resultRef.current;
  }

  const { tiles, animations, mergedIds, spawnedId } = trackMove(
    tilesRef.current,
    board,
    direction,
    boardSize,
  );
  tilesRef.current = tiles;
  prevBoardRef.current = board;

  // Build animation lookup: tileId -> {fromRow, fromCol}
  const animLookup = new Map<
    number,
    { fromRow: number; fromCol: number; type: string }
  >();
  for (const a of animations) {
    // For merge-source, both sources map to same destination.
    // We don't render merge-source tiles; we render the new merged tile instead.
    animLookup.set(a.tileId, {
      fromRow: a.fromRow,
      fromCol: a.fromCol,
      type: a.type,
    });
  }

  // For merged tiles, find the first source animation to use as "from" position
  const mergeSourcePositions = new Map<
    string,
    { fromRow: number; fromCol: number }
  >();
  for (const a of animations) {
    if (a.type === "merge-source") {
      const destKey = `${a.toRow},${a.toCol}`;
      if (!mergeSourcePositions.has(destKey)) {
        mergeSourcePositions.set(destKey, {
          fromRow: a.fromRow,
          fromCol: a.fromCol,
        });
      }
    }
  }

  const renderData: TileRenderData[] = tiles.map((t) => {
    if (t.id === spawnedId) {
      return {
        key: t.id,
        value: t.value,
        row: t.row,
        col: t.col,
        fromRow: t.row,
        fromCol: t.col,
        animationType: "spawn" as const,
      };
    }

    if (mergedIds.has(t.id)) {
      // Use first merge source position as "from"
      const src = mergeSourcePositions.get(`${t.row},${t.col}`);
      return {
        key: t.id,
        value: t.value,
        row: t.row,
        col: t.col,
        fromRow: src?.fromRow ?? t.row,
        fromCol: src?.fromCol ?? t.col,
        animationType: "merge" as const,
      };
    }

    // Check if this tile slid
    const anim = animLookup.get(t.id);
    if (anim && anim.type === "slide") {
      return {
        key: t.id,
        value: t.value,
        row: t.row,
        col: t.col,
        fromRow: anim.fromRow,
        fromCol: anim.fromCol,
        animationType: "slide" as const,
      };
    }

    return {
      key: t.id,
      value: t.value,
      row: t.row,
      col: t.col,
      fromRow: t.row,
      fromCol: t.col,
      animationType: "none" as const,
    };
  });

  resultRef.current = renderData;
  return resultRef.current;
}
