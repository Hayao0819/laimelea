import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { SaveSlotList } from "../../../../src/features/game2048/components/SaveSlotList";
import type { GameSnapshot } from "../../../../src/features/game2048/logic/gameTypes";

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

jest.mock("date-fns", () => ({
  format: jest.fn(() => "03/01 12:00"),
}));

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

function makeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    id: "test-1",
    name: "Test Save",
    state: {
      board: [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 4],
      ],
      score: 100,
      boardSize: 4,
      isGameOver: false,
      hasWon: false,
      wonAcknowledged: false,
      moveCount: 10,
    },
    timestamp: 1700000000000,
    parentSnapshotId: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SaveSlotList", () => {
  const defaultProps = {
    visible: true,
    onDismiss: jest.fn(),
    snapshots: [] as GameSnapshot[],
    onSave: jest.fn(),
    onLoad: jest.fn(),
    onDelete: jest.fn(),
  };

  it("should not render when not visible", async () => {
    const { queryByTestId } = await renderWithPaper(
      <SaveSlotList {...defaultProps} visible={false} />,
    );
    expect(queryByTestId("save-slot-dialog")).toBeNull();
  });

  it("should show empty state when no snapshots", async () => {
    const { getByText } = await renderWithPaper(
      <SaveSlotList {...defaultProps} snapshots={[]} />,
    );
    expect(getByText("game2048.noSnapshots")).toBeTruthy();
  });

  it("should show snapshot list", async () => {
    const snapshots = [
      makeSnapshot({ id: "snap-1", name: "Save A" }),
      makeSnapshot({ id: "snap-2", name: "Save B" }),
    ];
    const { getByText, getByTestId } = await renderWithPaper(
      <SaveSlotList {...defaultProps} snapshots={snapshots} />,
    );
    expect(getByText("Save A")).toBeTruthy();
    expect(getByText("Save B")).toBeTruthy();
    expect(getByTestId("snapshot-snap-1")).toBeTruthy();
    expect(getByTestId("snapshot-snap-2")).toBeTruthy();
  });

  it("should show save input when save button pressed", async () => {
    const { getByTestId, queryByTestId } = await renderWithPaper(
      <SaveSlotList {...defaultProps} />,
    );
    // Initially no save input
    expect(queryByTestId("save-name-input")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("save-current-button"));
    });

    expect(getByTestId("save-name-input")).toBeTruthy();
    expect(getByTestId("confirm-save-button")).toBeTruthy();
  });

  it("should call onSave with name when confirmed", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <SaveSlotList {...defaultProps} onSave={onSave} />,
    );

    // Open save input
    await act(async () => {
      fireEvent.press(getByTestId("save-current-button"));
    });

    // Type a name
    await act(async () => {
      fireEvent.changeText(getByTestId("save-name-input"), "My Save");
    });

    // Confirm save
    await act(async () => {
      fireEvent.press(getByTestId("confirm-save-button"));
    });

    expect(onSave).toHaveBeenCalledWith("My Save");
  });

  it("should call onSave with default name when empty", async () => {
    const onSave = jest.fn();
    const snapshots = [makeSnapshot()];
    const { getByTestId } = await renderWithPaper(
      <SaveSlotList {...defaultProps} onSave={onSave} snapshots={snapshots} />,
    );

    // Open save input
    await act(async () => {
      fireEvent.press(getByTestId("save-current-button"));
    });

    // Leave input empty and confirm
    await act(async () => {
      fireEvent.press(getByTestId("confirm-save-button"));
    });

    // Default name is "Save #N" where N = snapshots.length + 1
    expect(onSave).toHaveBeenCalledWith("Save #2");
  });

  it("should call onLoad when load button pressed", async () => {
    const onLoad = jest.fn();
    const snapshot = makeSnapshot({ id: "snap-load" });
    const { getByTestId } = await renderWithPaper(
      <SaveSlotList {...defaultProps} snapshots={[snapshot]} onLoad={onLoad} />,
    );

    await fireEvent.press(getByTestId("load-snap-load"));
    expect(onLoad).toHaveBeenCalledWith(snapshot);
  });

  it("should call onDelete when delete button pressed", async () => {
    const onDelete = jest.fn();
    const snapshot = makeSnapshot({ id: "snap-del" });
    const { getByTestId } = await renderWithPaper(
      <SaveSlotList
        {...defaultProps}
        snapshots={[snapshot]}
        onDelete={onDelete}
      />,
    );

    await fireEvent.press(getByTestId("delete-snap-del"));
    expect(onDelete).toHaveBeenCalledWith("snap-del");
  });

  it("should call onDismiss when OK pressed", async () => {
    const onDismiss = jest.fn();
    const { getByText } = await renderWithPaper(
      <SaveSlotList {...defaultProps} onDismiss={onDismiss} />,
    );

    await fireEvent.press(getByText("common.ok"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
