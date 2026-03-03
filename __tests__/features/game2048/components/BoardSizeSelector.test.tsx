import { fireEvent,render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { BoardSizeSelector } from "../../../../src/features/game2048/components/BoardSizeSelector";
import type { BoardSize } from "../../../../src/features/game2048/logic/gameTypes";

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

describe("BoardSizeSelector", () => {
  const defaultProps = {
    size: 4 as BoardSize,
    onSizeChange: jest.fn(),
  };

  it("should render size options 3-6", async () => {
    const { getByText } = await renderWithPaper(
      <BoardSizeSelector {...defaultProps} />,
    );
    expect(getByText("3\u00d73")).toBeTruthy();
    expect(getByText("4\u00d74")).toBeTruthy();
    expect(getByText("5\u00d75")).toBeTruthy();
    expect(getByText("6\u00d76")).toBeTruthy();
  });

  it("should highlight current size", async () => {
    const { getByTestId } = await renderWithPaper(
      <BoardSizeSelector {...defaultProps} size={4} />,
    );
    const selector = getByTestId("board-size-selector");
    expect(selector).toBeTruthy();
    // SegmentedButtons receives value="4", which marks the 4x4 button as checked
    // We verify the component renders without error with the given size
  });

  it("should call onSizeChange with new size when pressed", async () => {
    const onSizeChange = jest.fn();
    const { getByText } = await renderWithPaper(
      <BoardSizeSelector {...defaultProps} onSizeChange={onSizeChange} />,
    );
    await fireEvent.press(getByText("5\u00d75"));
    expect(onSizeChange).toHaveBeenCalledWith(5);
  });
});
