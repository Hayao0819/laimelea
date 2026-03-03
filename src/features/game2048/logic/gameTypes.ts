export type Direction = "up" | "down" | "left" | "right";

export type BoardSize = 3 | 4 | 5 | 6;

export interface GameState {
  board: number[][];
  score: number;
  boardSize: BoardSize;
  isGameOver: boolean;
  hasWon: boolean;
  wonAcknowledged: boolean;
  moveCount: number;
}

export interface GameSnapshot {
  id: string;
  name: string;
  state: GameState;
  timestamp: number;
  parentSnapshotId: string | null;
}

export interface Game2048Settings {
  luckyMode: boolean;
}

export interface Game2048Store {
  currentGame: GameState;
  bestScores: Record<BoardSize, number>;
  history: GameState[];
  snapshots: GameSnapshot[];
  unlockedAt: number | null;
  perSizeGames: Partial<
    Record<BoardSize, { game: GameState; history: GameState[] }>
  >;
  settings: Game2048Settings;
  activeSnapshotId: string | null;
  autoSaveMaxTile: Record<BoardSize, number>;
}
