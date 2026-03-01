import { atom } from "jotai";
import { atomWithStorage, unwrap } from "jotai/utils";
import { createAsyncStorage } from "../../../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import type { BoardSize, Game2048Store, GameState } from "../logic/gameTypes";
import {
  createDefaultStore,
  createNewGame,
  MAX_HISTORY_SIZE,
} from "../logic/gameEngine";

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
  set(game2048StoreAtom, {
    ...store,
    currentGame: createNewGame(size),
    history: [],
  });
});
