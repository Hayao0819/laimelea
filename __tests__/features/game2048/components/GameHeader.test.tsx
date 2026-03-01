import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { GameHeader } from "../../../../src/features/game2048/components/GameHeader";

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

describe("GameHeader", () => {
  const defaultProps = {
    score: 1234,
    bestScore: 5678,
    canUndo: true,
    onUndo: jest.fn(),
    onNewGame: jest.fn(),
  };

  it("should render score and best score", async () => {
    const { getByText } = await renderWithPaper(
      <GameHeader {...defaultProps} />,
    );
    expect(getByText("1234")).toBeTruthy();
    expect(getByText("5678")).toBeTruthy();
    expect(getByText("game2048.score")).toBeTruthy();
    expect(getByText("game2048.best")).toBeTruthy();
  });

  it("should show undo button", async () => {
    const { getByTestId } = await renderWithPaper(
      <GameHeader {...defaultProps} />,
    );
    expect(getByTestId("undo-button")).toBeTruthy();
  });

  it("should call onUndo when undo button pressed", async () => {
    const onUndo = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <GameHeader {...defaultProps} onUndo={onUndo} />,
    );
    await fireEvent.press(getByTestId("undo-button"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("should call onNewGame when new game button pressed", async () => {
    const onNewGame = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <GameHeader {...defaultProps} onNewGame={onNewGame} />,
    );
    await fireEvent.press(getByTestId("new-game-button"));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it("should disable undo when canUndo is false", async () => {
    const onUndo = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <GameHeader {...defaultProps} canUndo={false} onUndo={onUndo} />,
    );
    const undoButton = getByTestId("undo-button");
    expect(undoButton).toBeDisabled();
    await fireEvent.press(undoButton);
    expect(onUndo).not.toHaveBeenCalled();
  });
});
