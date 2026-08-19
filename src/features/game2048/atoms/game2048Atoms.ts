import { atom } from "jotai";

import { STORAGE_KEYS } from "../../../core/storage/keys";
import { createPersistedAtom } from "../../../core/storage/persistedAtom";
import {
  createDefaultStore,
  createNewGame,
  generateSnapshotName,
  getMaxTile,
  MAX_HISTORY_SIZE,
  nextSnapshotIndex,
} from "../logic/gameEngine";
import type {
  BoardSize,
  Game2048Settings,
  Game2048Store,
  GameSnapshot,
  GameState,
} from "../logic/gameTypes";

const DEFAULT_STORE = createDefaultStore();
const BOARD_SIZES = [3, 4, 5, 6] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoardSize(value: unknown): value is BoardSize {
  return typeof value === "number" && BOARD_SIZES.includes(value as BoardSize);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isTileValue(value: unknown): value is number {
  return (
    isNonNegativeSafeInteger(value) &&
    (value === 0 || (value > 1 && Number.isInteger(Math.log2(value))))
  );
}

function normalizeGameState(
  value: unknown,
  expectedBoardSize?: BoardSize,
): GameState | null {
  if (!isRecord(value) || !isBoardSize(value.boardSize)) return null;
  if (
    expectedBoardSize !== undefined &&
    value.boardSize !== expectedBoardSize
  ) {
    return null;
  }
  const boardSize = value.boardSize;
  if (
    !Array.isArray(value.board) ||
    value.board.length !== boardSize ||
    !value.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === boardSize &&
        row.every(isTileValue),
    ) ||
    !isNonNegativeSafeInteger(value.score) ||
    typeof value.isGameOver !== "boolean" ||
    typeof value.hasWon !== "boolean" ||
    typeof value.wonAcknowledged !== "boolean" ||
    !isNonNegativeSafeInteger(value.moveCount)
  ) {
    return null;
  }
  return {
    board: value.board.map((row) => [...row]),
    score: value.score,
    boardSize,
    isGameOver: value.isGameOver,
    hasWon: value.hasWon,
    wonAcknowledged: value.wonAcknowledged,
    moveCount: value.moveCount,
  };
}

function normalizeSnapshots(value: unknown): GameSnapshot[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const snapshots = value.flatMap((snapshot): GameSnapshot[] => {
    if (
      !isRecord(snapshot) ||
      typeof snapshot.id !== "string" ||
      !snapshot.id
    ) {
      return [];
    }
    if (ids.has(snapshot.id) || typeof snapshot.name !== "string") return [];
    const state = normalizeGameState(snapshot.state);
    if (!state || !isNonNegativeSafeInteger(snapshot.timestamp)) return [];
    if (
      snapshot.parentSnapshotId !== null &&
      typeof snapshot.parentSnapshotId !== "string"
    ) {
      return [];
    }
    ids.add(snapshot.id);
    return [
      {
        id: snapshot.id,
        name: snapshot.name,
        state,
        timestamp: snapshot.timestamp,
        parentSnapshotId: snapshot.parentSnapshotId,
      },
    ];
  });
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

  return snapshots.map((snapshot) => {
    const ancestors = new Set([snapshot.id]);
    const parentSnapshotId = snapshot.parentSnapshotId;
    let ancestorId = parentSnapshotId;
    let hasCycle = false;
    while (ancestorId !== null) {
      if (ancestors.has(ancestorId)) {
        hasCycle = true;
        break;
      }
      ancestors.add(ancestorId);
      ancestorId = byId.get(ancestorId)?.parentSnapshotId ?? null;
    }
    return {
      ...snapshot,
      parentSnapshotId:
        hasCycle || (parentSnapshotId !== null && !byId.has(parentSnapshotId))
          ? null
          : parentSnapshotId,
    };
  });
}

function normalizePerSizeGames(value: unknown): Game2048Store["perSizeGames"] {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    BOARD_SIZES.flatMap((size) => {
      const entry = value[String(size)];
      if (!isRecord(entry)) return [];
      const game = normalizeGameState(entry.game, size);
      if (!game || !Array.isArray(entry.history)) return [];
      const history = entry.history
        .map((state) => normalizeGameState(state, size))
        .filter((state): state is GameState => state !== null)
        .slice(-MAX_HISTORY_SIZE);
      return [[size, { game, history }] as const];
    }),
  ) as Game2048Store["perSizeGames"];
}

export function normalizeGame2048Store(value: unknown): Game2048Store {
  const fallback = createDefaultStore();
  if (!isRecord(value)) return fallback;

  const currentGame =
    normalizeGameState(value.currentGame) ?? fallback.currentGame;
  const bestScores = Object.fromEntries(
    BOARD_SIZES.map((size) => [
      size,
      isNonNegativeSafeInteger(
        isRecord(value.bestScores) ? value.bestScores[String(size)] : undefined,
      )
        ? (value.bestScores as Record<string, number>)[String(size)]
        : 0,
    ]),
  ) as Game2048Store["bestScores"];
  const history = Array.isArray(value.history)
    ? value.history
        .map((state) => normalizeGameState(state, currentGame.boardSize))
        .filter((state): state is GameState => state !== null)
        .slice(-MAX_HISTORY_SIZE)
    : [];
  const snapshots = normalizeSnapshots(value.snapshots);
  const snapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));
  const perSizeGames = normalizePerSizeGames(value.perSizeGames);
  // Legacy backups predate autoSaveMaxTile, so a missing/zero entry for a
  // size that already has tiles would otherwise trigger a spurious
  // milestone save on the next move; reseed it from the actual board.
  const autoSaveMaxTile = Object.fromEntries(
    BOARD_SIZES.map((size) => {
      const stored = isNonNegativeSafeInteger(
        isRecord(value.autoSaveMaxTile)
          ? value.autoSaveMaxTile[String(size)]
          : undefined,
      )
        ? (value.autoSaveMaxTile as Record<string, number>)[String(size)]
        : 0;
      const board =
        size === currentGame.boardSize
          ? currentGame.board
          : perSizeGames[size]?.game.board;
      return [size, board ? Math.max(stored, getMaxTile(board)) : stored];
    }),
  ) as Game2048Store["autoSaveMaxTile"];

  return {
    currentGame,
    bestScores,
    history,
    snapshots,
    unlockedAt: isNonNegativeSafeInteger(value.unlockedAt)
      ? value.unlockedAt
      : null,
    perSizeGames,
    settings: {
      luckyMode:
        isRecord(value.settings) &&
        typeof value.settings.luckyMode === "boolean"
          ? value.settings.luckyMode
          : false,
    },
    activeSnapshotId:
      typeof value.activeSnapshotId === "string" &&
      snapshotIds.has(value.activeSnapshotId)
        ? value.activeSnapshotId
        : null,
    autoSaveMaxTile,
  };
}

const game2048Persistence = createPersistedAtom<Game2048Store>(
  STORAGE_KEYS.GAME_2048,
  DEFAULT_STORE,
  normalizeGame2048Store,
);

const game2048StoredAtom = game2048Persistence.valueAtom;
export const game2048HydratedAtom = game2048Persistence.hydratedAtom;

export const game2048StoreAtom = atom(
  (get) => get(game2048StoredAtom),
  async (
    get,
    set,
    update: Game2048Store | ((previous: Game2048Store) => Game2048Store),
  ): Promise<void> => {
    const previous = get(game2048StoredAtom);
    const candidate = typeof update === "function" ? update(previous) : update;
    if (candidate === previous) return;
    const next = normalizeGame2048Store(candidate);
    try {
      await Promise.resolve(set(game2048StoredAtom, next));
    } catch {
      if (get(game2048StoredAtom) !== next) return;
      try {
        await Promise.resolve(set(game2048StoredAtom, previous));
      } catch {}
    }
  },
);

export const resolvedStoreAtom = atom<Game2048Store>((get) => {
  return get(game2048StoreAtom);
});

export const currentGameAtom = atom(
  (get) => get(resolvedStoreAtom).currentGame,
);
export const bestScoresAtom = atom((get) => get(resolvedStoreAtom).bestScores);
export const canUndoAtom = atom(
  (get) => get(resolvedStoreAtom).history.length > 0,
);
export const snapshotsAtom = atom((get) => get(resolvedStoreAtom).snapshots);
export const isUnlockedAtom = atom(
  (get) => get(resolvedStoreAtom).unlockedAt !== null,
);
export const settingsAtom = atom((get) => get(resolvedStoreAtom).settings);
export const hasGameStartedAtom = atom(
  (get) => get(currentGameAtom).moveCount > 0,
);
export const activeSnapshotIdAtom = atom(
  (get) => get(resolvedStoreAtom).activeSnapshotId,
);

const commitGameStoreAtom = atom(
  null,
  async (
    get,
    set,
    update: (store: Game2048Store) => Game2048Store,
  ): Promise<void> => {
    let next: Game2048Store;
    try {
      next = update(get(resolvedStoreAtom));
    } catch {
      return;
    }
    await Promise.resolve(set(game2048StoreAtom, next));
  },
);

export const pushHistoryAtom = atom(null, (get, set, newState: GameState) => {
  if (!get(game2048HydratedAtom)) return;
  return set(commitGameStoreAtom, (store) => {
    const history = [...store.history, store.currentGame].slice(
      -MAX_HISTORY_SIZE,
    );
    const bestScore = Math.max(
      store.bestScores[newState.boardSize] ?? 0,
      newState.score,
    );
    return {
      ...store,
      currentGame: newState,
      history,
      bestScores: { ...store.bestScores, [newState.boardSize]: bestScore },
    };
  });
});

export const undoAtom = atom(null, (get, set) => {
  if (!get(game2048HydratedAtom)) return;
  return set(commitGameStoreAtom, (store) => {
    if (store.history.length === 0) return store;
    const history = [...store.history];
    const prevState = history.pop()!;
    return { ...store, currentGame: prevState, history };
  });
});

export const newGameAtom = atom(null, (get, set, size: BoardSize) => {
  if (!get(game2048HydratedAtom)) return;
  return set(commitGameStoreAtom, (store) => {
    const newGame = createNewGame(size);
    return {
      ...store,
      currentGame: newGame,
      history: [],
      activeSnapshotId: null,
      autoSaveMaxTile: {
        ...store.autoSaveMaxTile,
        [size]: getMaxTile(newGame.board),
      },
    };
  });
});

export const updateSettingsAtom = atom(
  null,
  (get, set, update: Partial<Game2048Settings>) => {
    if (!get(game2048HydratedAtom)) return;
    return set(commitGameStoreAtom, (store) => ({
      ...store,
      settings: { ...store.settings, ...update },
    }));
  },
);

export const switchBoardSizeAtom = atom(
  null,
  (get, set, newSize: BoardSize) => {
    if (!get(game2048HydratedAtom)) return;
    return set(commitGameStoreAtom, (store) => {
      const currentSize = store.currentGame.boardSize;
      if (currentSize === newSize) return store;

      const perSizeGames = { ...store.perSizeGames };
      perSizeGames[currentSize] = {
        game: store.currentGame,
        history: store.history,
      };

      const existing = perSizeGames[newSize];
      const newGame = existing?.game ?? createNewGame(newSize);
      const newHistory = existing?.history ?? [];

      delete perSizeGames[newSize];

      return {
        ...store,
        currentGame: newGame,
        history: newHistory,
        perSizeGames,
        activeSnapshotId: null,
        autoSaveMaxTile: existing
          ? store.autoSaveMaxTile
          : {
              ...store.autoSaveMaxTile,
              [newSize]: getMaxTile(newGame.board),
            },
      };
    });
  },
);

const MAX_GAME_OVER_AUTOSAVES_PER_SIZE = 3;

function pruneGameOverAutoSaves(
  snapshots: GameSnapshot[],
  boardSize: BoardSize,
): GameSnapshot[] {
  const prunable = snapshots
    .filter(
      (snapshot) =>
        snapshot.name.startsWith("Game Over") &&
        snapshot.state.boardSize === boardSize,
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  if (prunable.length <= MAX_GAME_OVER_AUTOSAVES_PER_SIZE) return snapshots;

  const idsToRemove = new Set(
    prunable
      .slice(0, prunable.length - MAX_GAME_OVER_AUTOSAVES_PER_SIZE)
      .map((snapshot) => snapshot.id),
  );
  return snapshots.filter((snapshot) => !idsToRemove.has(snapshot.id));
}

export const saveSnapshotAtom = atom(
  null,
  (get, set, isAutoSave: boolean = false) => {
    if (!get(game2048HydratedAtom)) return;
    return set(commitGameStoreAtom, (store) => {
      const game = store.currentGame;
      const kindNames = store.snapshots
        .filter((snapshot) =>
          isAutoSave
            ? snapshot.name.startsWith("Game Over")
            : snapshot.name.startsWith("Save"),
        )
        .map((snapshot) => snapshot.name);
      const snapshot: GameSnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: generateSnapshotName(
          game,
          isAutoSave,
          nextSnapshotIndex(kindNames),
        ),
        state: { ...game },
        timestamp: Date.now(),
        parentSnapshotId: store.activeSnapshotId,
      };
      let snapshots = [...store.snapshots, snapshot];
      if (isAutoSave) {
        snapshots = pruneGameOverAutoSaves(snapshots, game.boardSize);
      }
      return {
        ...store,
        snapshots,
        activeSnapshotId: snapshot.id,
      };
    });
  },
);

export const loadSnapshotAtom = atom(
  null,
  (get, set, snapshot: GameSnapshot) => {
    if (!get(game2048HydratedAtom)) return;
    return set(commitGameStoreAtom, (store) => {
      const currentSize = store.currentGame.boardSize;
      const snapshotSize = snapshot.state.boardSize;

      const perSizeGames = { ...store.perSizeGames };
      perSizeGames[currentSize] = {
        game: store.currentGame,
        history: store.history,
      };
      delete perSizeGames[snapshotSize];

      return {
        ...store,
        currentGame: { ...snapshot.state },
        history: [],
        perSizeGames,
        activeSnapshotId: snapshot.id,
        autoSaveMaxTile: {
          ...store.autoSaveMaxTile,
          [snapshotSize]: getMaxTile(snapshot.state.board),
        },
      };
    });
  },
);

export const acknowledgeWinAtom = atom(null, (get, set) => {
  if (!get(game2048HydratedAtom)) return;
  return set(commitGameStoreAtom, (store) => ({
    ...store,
    currentGame: { ...store.currentGame, wonAcknowledged: true },
  }));
});

export const deleteSnapshotAtom = atom(null, (get, set, snapshotId: string) => {
  if (!get(game2048HydratedAtom)) return;
  return set(commitGameStoreAtom, (store) => ({
    ...store,
    snapshots: store.snapshots.filter((snapshot) => snapshot.id !== snapshotId),
    activeSnapshotId:
      store.activeSnapshotId === snapshotId ? null : store.activeSnapshotId,
  }));
});

export const milestoneAutoSaveAtom = atom(
  null,
  (get, set, newState: GameState) => {
    if (!get(game2048HydratedAtom)) return;
    return set(commitGameStoreAtom, (store) => {
      const maxTile = getMaxTile(newState.board);
      const recorded = store.autoSaveMaxTile[newState.boardSize] ?? 0;

      if (maxTile <= recorded) return store;

      const milestoneNames = store.snapshots
        .filter((snapshot) => snapshot.name.startsWith("Reached"))
        .map((snapshot) => snapshot.name);
      const snapshot: GameSnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: generateSnapshotName(
          newState,
          false,
          nextSnapshotIndex(milestoneNames),
          maxTile,
        ),
        state: { ...newState },
        timestamp: Date.now(),
        parentSnapshotId: store.activeSnapshotId,
      };
      return {
        ...store,
        snapshots: [...store.snapshots, snapshot],
        activeSnapshotId: snapshot.id,
        autoSaveMaxTile: {
          ...store.autoSaveMaxTile,
          [newState.boardSize]: maxTile,
        },
      };
    });
  },
);
