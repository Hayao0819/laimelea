import { atom } from "jotai";
import { atomWithStorage, unwrap } from "jotai/utils";

import { createAsyncStorage } from "../../../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import {
  createDefaultStore,
  createNewGame,
  generateSnapshotName,
  getMaxTile,
  MAX_HISTORY_SIZE,
} from "../logic/gameEngine";
import type {
  BoardSize,
  Game2048Settings,
  Game2048Store,
  GameSnapshot,
  GameState,
} from "../logic/gameTypes";

const DEFAULT_STORE = createDefaultStore();

export const game2048StoreAtom = atomWithStorage<Game2048Store>(
  STORAGE_KEYS.GAME_2048,
  DEFAULT_STORE,
  createAsyncStorage<Game2048Store>(),
  { getOnInit: true },
);

// unwrap gives a synchronous view: falls back to DEFAULT_STORE while the
// AsyncStorage promise is pending, then resolves to the persisted value.
const syncStoreAtom = unwrap(
  game2048StoreAtom,
  (prev) => prev ?? DEFAULT_STORE,
);

export const resolvedStoreAtom = atom<Game2048Store>((get) => {
  const stored = get(syncStoreAtom);
  return { ...DEFAULT_STORE, ...stored };
});

// Derived read atoms
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

// Write atoms for game actions
export const pushHistoryAtom = atom(null, (get, set, newState: GameState) => {
  const store = get(resolvedStoreAtom);
  const history = [...store.history, store.currentGame].slice(
    -MAX_HISTORY_SIZE,
  );
  const bestScore = Math.max(
    store.bestScores[newState.boardSize] ?? 0,
    newState.score,
  );
  set(game2048StoreAtom, {
    ...store,
    currentGame: newState,
    history,
    bestScores: { ...store.bestScores, [newState.boardSize]: bestScore },
  });
});

export const undoAtom = atom(null, (get, set) => {
  const store = get(resolvedStoreAtom);
  if (store.history.length === 0) return;
  const history = [...store.history];
  const prevState = history.pop()!;
  set(game2048StoreAtom, { ...store, currentGame: prevState, history });
});

export const newGameAtom = atom(null, (get, set, size: BoardSize) => {
  const store = get(resolvedStoreAtom);
  const newGame = createNewGame(size);
  set(game2048StoreAtom, {
    ...store,
    currentGame: newGame,
    history: [],
    activeSnapshotId: null,
    autoSaveMaxTile: {
      ...store.autoSaveMaxTile,
      [size]: getMaxTile(newGame.board),
    },
  });
});

export const updateSettingsAtom = atom(
  null,
  (get, set, update: Partial<Game2048Settings>) => {
    const store = get(resolvedStoreAtom);
    set(game2048StoreAtom, {
      ...store,
      settings: { ...store.settings, ...update },
    });
  },
);

export const switchBoardSizeAtom = atom(
  null,
  (get, set, newSize: BoardSize) => {
    const store = get(resolvedStoreAtom);
    const currentSize = store.currentGame.boardSize;
    if (currentSize === newSize) return;

    // Save current game state to perSizeGames
    const perSizeGames = { ...store.perSizeGames };
    perSizeGames[currentSize] = {
      game: store.currentGame,
      history: store.history,
    };

    // Load existing state for the new size, or create a new game
    const existing = perSizeGames[newSize];
    const newGame = existing?.game ?? createNewGame(newSize);
    const newHistory = existing?.history ?? [];

    // Remove loaded size from perSizeGames to avoid double storage
    delete perSizeGames[newSize];

    set(game2048StoreAtom, {
      ...store,
      currentGame: newGame,
      history: newHistory,
      perSizeGames,
      activeSnapshotId: null,
    });
  },
);

export const saveSnapshotAtom = atom(
  null,
  (get, set, isAutoSave: boolean = false) => {
    const store = get(resolvedStoreAtom);
    const game = store.currentGame;

    const existingCount = store.snapshots.filter((s) =>
      isAutoSave ? s.name.startsWith("Game Over") : s.name.startsWith("Save"),
    ).length;

    const snapshot: GameSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: generateSnapshotName(game, isAutoSave, existingCount + 1),
      state: { ...game },
      timestamp: Date.now(),
      parentSnapshotId: store.activeSnapshotId,
    };

    set(game2048StoreAtom, {
      ...store,
      snapshots: [...store.snapshots, snapshot],
      activeSnapshotId: snapshot.id,
    });
  },
);

export const loadSnapshotAtom = atom(
  null,
  (get, set, snapshot: GameSnapshot) => {
    const store = get(resolvedStoreAtom);
    set(game2048StoreAtom, {
      ...store,
      currentGame: { ...snapshot.state },
      history: [],
      activeSnapshotId: snapshot.id,
      autoSaveMaxTile: {
        ...store.autoSaveMaxTile,
        [snapshot.state.boardSize]: getMaxTile(snapshot.state.board),
      },
    });
  },
);

export const milestoneAutoSaveAtom = atom(
  null,
  (get, set, newState: GameState) => {
    const store = get(resolvedStoreAtom);
    const maxTile = getMaxTile(newState.board);
    const recorded = store.autoSaveMaxTile[newState.boardSize] ?? 0;

    if (maxTile <= recorded) return;

    const existingCount = store.snapshots.filter((s) =>
      s.name.startsWith("Reached"),
    ).length;

    const snapshot: GameSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: generateSnapshotName(newState, false, existingCount + 1, maxTile),
      state: { ...newState },
      timestamp: Date.now(),
      parentSnapshotId: store.activeSnapshotId,
    };

    set(game2048StoreAtom, {
      ...store,
      snapshots: [...store.snapshots, snapshot],
      activeSnapshotId: snapshot.id,
      autoSaveMaxTile: {
        ...store.autoSaveMaxTile,
        [newState.boardSize]: maxTile,
      },
    });
  },
);
