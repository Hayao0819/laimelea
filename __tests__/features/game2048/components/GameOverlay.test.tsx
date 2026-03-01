import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { GameOverlay } from "../../../../src/features/game2048/components/GameOverlay";

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

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GameOverlay", () => {
  const defaultProps = {
    isGameOver: false,
    hasWon: false,
    wonAcknowledged: false,
    onKeepGoing: jest.fn(),
    onTryAgain: jest.fn(),
  };

  it("should not render when game is ongoing", async () => {
    const { queryByTestId } = await renderWithPaper(
      <GameOverlay {...defaultProps} />,
    );
    expect(queryByTestId("game-overlay")).toBeNull();
  });

  it("should show game over message when isGameOver is true", async () => {
    const { getByTestId, getByText, queryByTestId } = await renderWithPaper(
      <GameOverlay {...defaultProps} isGameOver={true} />,
    );
    expect(getByTestId("game-overlay")).toBeTruthy();
    expect(getByText("game2048.gameOver")).toBeTruthy();
    expect(getByTestId("try-again-button")).toBeTruthy();
    // Keep going button should NOT show on game over
    expect(queryByTestId("keep-going-button")).toBeNull();
  });

  it("should show win message when hasWon and not acknowledged", async () => {
    const { getByTestId, getByText } = await renderWithPaper(
      <GameOverlay
        {...defaultProps}
        hasWon={true}
        wonAcknowledged={false}
      />,
    );
    expect(getByTestId("game-overlay")).toBeTruthy();
    expect(getByText("game2048.youWin")).toBeTruthy();
    expect(getByTestId("keep-going-button")).toBeTruthy();
    expect(getByTestId("try-again-button")).toBeTruthy();
  });

  it("should not show when hasWon and wonAcknowledged", async () => {
    const { queryByTestId } = await renderWithPaper(
      <GameOverlay {...defaultProps} hasWon={true} wonAcknowledged={true} />,
    );
    expect(queryByTestId("game-overlay")).toBeNull();
  });

  it("should call onKeepGoing when keep going button pressed", async () => {
    const onKeepGoing = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <GameOverlay
        {...defaultProps}
        hasWon={true}
        wonAcknowledged={false}
        onKeepGoing={onKeepGoing}
      />,
    );
    await fireEvent.press(getByTestId("keep-going-button"));
    expect(onKeepGoing).toHaveBeenCalledTimes(1);
  });

  it("should call onTryAgain when try again button pressed", async () => {
    const onTryAgain = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <GameOverlay {...defaultProps} isGameOver={true} onTryAgain={onTryAgain} />,
    );
    await fireEvent.press(getByTestId("try-again-button"));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });
});
