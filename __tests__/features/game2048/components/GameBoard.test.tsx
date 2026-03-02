import React from "react";
import { render, act } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import {
  GameBoard,
  type GameBoardProps,
} from "../../../../src/features/game2048/components/GameBoard";

jest.mock("../../../../src/features/game2048/hooks/useAnimatedBoard", () => ({
  useAnimatedBoard: () => [],
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

function renderBoard(props: Partial<GameBoardProps> = {}) {
  const defaultProps: GameBoardProps = {
    board: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 0, 4],
    ],
    boardSize: 4,
    onMove: jest.fn(),
    direction: null,
  };
  return {
    onMove: (props.onMove ?? defaultProps.onMove) as jest.Mock,
    ...render(
      <PaperProvider>
        <GameBoard {...defaultProps} {...props} />
      </PaperProvider>,
    ),
  };
}

// fireEvent from @testing-library/react-native blocks events when
// PanResponder is present (touch responder check). We invoke onKeyUp
// directly via the element props + act, which accurately tests the handler.
function simulateKeyUp(
  element: { props: Record<string, unknown> },
  key: string,
) {
  const handler = element.props.onKeyUp as
    | ((e: { nativeEvent: { key: string } }) => void)
    | undefined;
  if (handler) {
    act(() => {
      handler({ nativeEvent: { key } });
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GameBoard keyboard input", () => {
  describe("arrow keys", () => {
    it("should call onMove('up') on ArrowUp key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "ArrowUp");

      expect(onMove).toHaveBeenCalledWith("up");
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("should call onMove('down') on ArrowDown key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "ArrowDown");

      expect(onMove).toHaveBeenCalledWith("down");
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("should call onMove('left') on ArrowLeft key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "ArrowLeft");

      expect(onMove).toHaveBeenCalledWith("left");
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("should call onMove('right') on ArrowRight key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "ArrowRight");

      expect(onMove).toHaveBeenCalledWith("right");
      expect(onMove).toHaveBeenCalledTimes(1);
    });
  });

  describe("WASD keys", () => {
    it("should call onMove('up') on w key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "w");

      expect(onMove).toHaveBeenCalledWith("up");
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("should call onMove('left') on a key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "a");

      expect(onMove).toHaveBeenCalledWith("left");
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("should call onMove('down') on s key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "s");

      expect(onMove).toHaveBeenCalledWith("down");
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("should call onMove('right') on d key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "d");

      expect(onMove).toHaveBeenCalledWith("right");
      expect(onMove).toHaveBeenCalledTimes(1);
    });
  });

  describe("unmapped keys", () => {
    it("should not call onMove for Enter key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "Enter");

      expect(onMove).not.toHaveBeenCalled();
    });

    it("should not call onMove for x key", async () => {
      const { onMove, getByTestId } = await renderBoard();
      const board = getByTestId("game-board");

      simulateKeyUp(board, "x");

      expect(onMove).not.toHaveBeenCalled();
    });
  });
});
