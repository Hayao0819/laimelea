import type {
  BoardSize,
  Direction,
  Game2048Store,
  GameState,
} from "./gameTypes";

export const MAX_HISTORY_SIZE = 100;

/**
 * Returns the win target tile value for a given board size.
 * 3->512, 4->2048, 5->4096, 6->8192
 */
const WIN_TARGETS: Record<BoardSize, number> = {
  3: 512,
  4: 2048,
  5: 4096,
  6: 8192,
};

export function getWinTarget(size: BoardSize): number {
  return WIN_TARGETS[size];
}

export function createEmptyBoard(size: BoardSize): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0) as number[]);
}

export function spawnTile(
  board: number[][],
  random: () => number = Math.random,
): number[][] {
  const emptyCells: [number, number][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === 0) {
        emptyCells.push([r, c]);
      }
    }
  }

  if (emptyCells.length === 0) {
    return board;
  }

  const newBoard = board.map((row) => [...row]);
  const idx = Math.floor(random() * emptyCells.length);
  const [row, col] = emptyCells[idx];
  newBoard[row][col] = random() < 0.9 ? 2 : 4;
  return newBoard;
}

export function createNewGame(size: BoardSize): GameState {
  let board = createEmptyBoard(size);
  board = spawnTile(board);
  board = spawnTile(board);

  return {
    board,
    score: 0,
    boardSize: size,
    isGameOver: false,
    hasWon: false,
    wonAcknowledged: false,
    moveCount: 0,
  };
}

export function slideRow(row: number[]): {
  row: number[];
  scoreGained: number;
  moved: boolean;
} {
  const size = row.length;

  // Remove zeros
  const nonZero = row.filter((v) => v !== 0);

  // Merge adjacent equal tiles from left to right
  const merged: number[] = [];
  let scoreGained = 0;
  let i = 0;
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const val = nonZero[i] * 2;
      merged.push(val);
      scoreGained += val;
      i += 2;
    } else {
      merged.push(nonZero[i]);
      i += 1;
    }
  }

  // Pad with zeros on the right
  while (merged.length < size) {
    merged.push(0);
  }

  const moved = merged.some((v, idx) => v !== row[idx]);

  return { row: merged, scoreGained, moved };
}

function transpose(board: number[][]): number[][] {
  const size = board.length;
  const result: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(board[c][r]);
    }
    result.push(row);
  }
  return result;
}

function reverseRows(board: number[][]): number[][] {
  return board.map((row) => [...row].reverse());
}

export function move(
  state: GameState,
  direction: Direction,
): { state: GameState; moved: boolean } {
  let board = state.board.map((row) => [...row]);
  let totalScore = 0;
  let anyMoved = false;

  // Transform board so we can always slide left
  if (direction === "right") {
    board = reverseRows(board);
  } else if (direction === "up") {
    board = transpose(board);
  } else if (direction === "down") {
    board = transpose(board);
    board = reverseRows(board);
  }

  // Apply slideRow to each row
  const newRows: number[][] = [];
  for (const row of board) {
    const result = slideRow(row);
    newRows.push(result.row);
    totalScore += result.scoreGained;
    if (result.moved) {
      anyMoved = true;
    }
  }
  board = newRows;

  // Transform back
  if (direction === "right") {
    board = reverseRows(board);
  } else if (direction === "up") {
    board = transpose(board);
  } else if (direction === "down") {
    board = reverseRows(board);
    board = transpose(board);
  }

  if (!anyMoved) {
    return { state, moved: false };
  }

  board = spawnTile(board);

  const newScore = state.score + totalScore;

  const newState: GameState = {
    board,
    score: newScore,
    boardSize: state.boardSize,
    isGameOver: false,
    hasWon: state.hasWon,
    wonAcknowledged: state.wonAcknowledged,
    moveCount: state.moveCount + 1,
  };

  // Check win condition (only if not already acknowledged)
  if (!state.wonAcknowledged && hasReachedWinTarget(newState)) {
    newState.hasWon = true;
  }

  // Check game over
  if (!canMove(newState)) {
    newState.isGameOver = true;
  }

  return { state: newState, moved: true };
}

export function canMove(state: GameState): boolean {
  const { board } = state;
  const size = board.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Empty cell exists
      if (board[r][c] === 0) {
        return true;
      }
      // Check right neighbor
      if (c + 1 < size && board[r][c] === board[r][c + 1]) {
        return true;
      }
      // Check bottom neighbor
      if (r + 1 < size && board[r][c] === board[r + 1][c]) {
        return true;
      }
    }
  }

  return false;
}

export function hasReachedWinTarget(state: GameState): boolean {
  const target = getWinTarget(state.boardSize);
  for (const row of state.board) {
    for (const cell of row) {
      if (cell >= target) {
        return true;
      }
    }
  }
  return false;
}

export function createDefaultStore(): Game2048Store {
  return {
    currentGame: createNewGame(4),
    bestScores: { 3: 0, 4: 0, 5: 0, 6: 0 },
    history: [],
    snapshots: [],
    unlockedAt: null,
  };
}
