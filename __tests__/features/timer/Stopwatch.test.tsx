import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { useStopwatch } from "../../../src/hooks/useStopwatch";
import { Stopwatch } from "../../../src/features/timer/components/Stopwatch";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../src/hooks/useStopwatch", () => ({
  useStopwatch: jest.fn(() => ({
    elapsedMs: 0,
    isRunning: false,
    laps: [],
    start: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    reset: jest.fn(),
    lap: jest.fn(),
  })),
}));

const mockUseStopwatch = useStopwatch as jest.MockedFunction<
  typeof useStopwatch
>;

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

function createMockStopwatch(
  overrides: Partial<ReturnType<typeof useStopwatch>> = {},
) {
  return {
    elapsedMs: 0,
    isRunning: false,
    laps: [] as number[],
    start: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    reset: jest.fn(),
    lap: jest.fn(),
    ...overrides,
  };
}

describe("Stopwatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStopwatch.mockReturnValue(createMockStopwatch());
  });

  it('should render display with "00:00.00" initially', async () => {
    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    const display = getByTestId("stopwatch-display");
    expect(display).toHaveTextContent("00:00.00");
  });

  it("should show start button when not started", async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <Stopwatch />,
    );

    expect(getByTestId("stopwatch-start")).toBeTruthy();
    expect(queryByTestId("stopwatch-pause")).toBeNull();
    expect(queryByTestId("stopwatch-lap")).toBeNull();
    expect(queryByTestId("stopwatch-resume")).toBeNull();
    expect(queryByTestId("stopwatch-reset")).toBeNull();
  });

  it("should show pause and lap buttons when running", async () => {
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({ elapsedMs: 1000, isRunning: true }),
    );

    const { getByTestId, queryByTestId } = await renderWithProviders(
      <Stopwatch />,
    );

    expect(getByTestId("stopwatch-pause")).toBeTruthy();
    expect(getByTestId("stopwatch-lap")).toBeTruthy();
    expect(queryByTestId("stopwatch-start")).toBeNull();
    expect(queryByTestId("stopwatch-resume")).toBeNull();
    expect(queryByTestId("stopwatch-reset")).toBeNull();
  });

  it("should show resume and reset buttons when paused", async () => {
    // paused: elapsedMs > 0, isRunning = false
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({ elapsedMs: 5000, isRunning: false }),
    );

    const { getByTestId, queryByTestId } = await renderWithProviders(
      <Stopwatch />,
    );

    expect(getByTestId("stopwatch-resume")).toBeTruthy();
    expect(getByTestId("stopwatch-reset")).toBeTruthy();
    expect(queryByTestId("stopwatch-start")).toBeNull();
    expect(queryByTestId("stopwatch-pause")).toBeNull();
    expect(queryByTestId("stopwatch-lap")).toBeNull();
  });

  it("should call start function when start button pressed", async () => {
    const mockStart = jest.fn();
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({ start: mockStart }),
    );

    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    await fireEvent.press(getByTestId("stopwatch-start"));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("should call pause function when pause button pressed", async () => {
    const mockPause = jest.fn();
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({
        elapsedMs: 1000,
        isRunning: true,
        pause: mockPause,
      }),
    );

    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    await fireEvent.press(getByTestId("stopwatch-pause"));
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it("should call resume function when resume button pressed", async () => {
    const mockResume = jest.fn();
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({
        elapsedMs: 5000,
        isRunning: false,
        resume: mockResume,
      }),
    );

    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    await fireEvent.press(getByTestId("stopwatch-resume"));
    expect(mockResume).toHaveBeenCalledTimes(1);
  });

  it("should call reset function when reset button pressed", async () => {
    const mockReset = jest.fn();
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({
        elapsedMs: 5000,
        isRunning: false,
        reset: mockReset,
      }),
    );

    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    await fireEvent.press(getByTestId("stopwatch-reset"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("should call lap function when lap button pressed", async () => {
    const mockLap = jest.fn();
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({
        elapsedMs: 1000,
        isRunning: true,
        lap: mockLap,
      }),
    );

    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    await fireEvent.press(getByTestId("stopwatch-lap"));
    expect(mockLap).toHaveBeenCalledTimes(1);
  });

  it("should format elapsed time correctly", async () => {
    // 65120ms = 1m 5s 12cs → "01:05.12"
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({ elapsedMs: 65120, isRunning: true }),
    );

    const { getByTestId } = await renderWithProviders(<Stopwatch />);
    expect(getByTestId("stopwatch-display")).toHaveTextContent("01:05.12");
  });

  it("should render lap list when laps exist", async () => {
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({
        elapsedMs: 5000,
        isRunning: true,
        laps: [1000, 3000, 5000],
      }),
    );

    const { getByText } = await renderWithProviders(<Stopwatch />);

    // Lap numbers should appear (displayed in reverse order)
    expect(
      getByText('timer.lapNumber:{"number":3}'),
    ).toBeTruthy();
    expect(
      getByText('timer.lapNumber:{"number":2}'),
    ).toBeTruthy();
    expect(
      getByText('timer.lapNumber:{"number":1}'),
    ).toBeTruthy();
  });

  it("should show noLaps message when started but no laps recorded", async () => {
    mockUseStopwatch.mockReturnValue(
      createMockStopwatch({ elapsedMs: 1000, isRunning: true, laps: [] }),
    );

    const { getByText } = await renderWithProviders(<Stopwatch />);
    expect(getByText("timer.noLaps")).toBeTruthy();
  });
});
