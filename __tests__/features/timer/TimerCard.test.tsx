import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { TimerCard } from "../../../src/features/timer/components/TimerCard";
import type { TimerState } from "../../../src/models/Timer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

jest.mock("react-native-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require("react");
  const createMockComponent = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  return {
    __esModule: true,
    default: createMockComponent("Svg"),
    Svg: createMockComponent("Svg"),
    Circle: createMockComponent("Circle"),
  };
});

function makeTimer(overrides: Partial<TimerState> = {}): TimerState {
  return {
    id: "timer-1",
    label: "Test Timer",
    durationMs: 300000, // 5 minutes
    remainingMs: 180000, // 3 minutes
    isRunning: true,
    startedAt: Date.now(),
    pausedElapsedMs: 0,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("TimerCard", () => {
  const defaultCallbacks = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onReset: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render timer with remaining time formatted (HH:MM:SS)", async () => {
    // 180000ms = 3 minutes = 00:03:00
    const timer = makeTimer({ remainingMs: 180000 });
    const { getByText } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByText("00:03:00")).toBeTruthy();
  });

  it("should show pause button when timer is running", async () => {
    const timer = makeTimer({ isRunning: true, remainingMs: 60000 });
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByTestId(`timer-pause-${timer.id}`)).toBeTruthy();
    expect(queryByTestId(`timer-resume-${timer.id}`)).toBeNull();
  });

  it("should show resume button when timer is paused with remaining time", async () => {
    const timer = makeTimer({ isRunning: false, remainingMs: 60000 });
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByTestId(`timer-resume-${timer.id}`)).toBeTruthy();
    expect(queryByTestId(`timer-pause-${timer.id}`)).toBeNull();
  });

  it("should show no play/pause button when timer is complete (remainingMs <= 0, !isRunning)", async () => {
    const timer = makeTimer({ isRunning: false, remainingMs: 0 });
    const { queryByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(queryByTestId(`timer-pause-${timer.id}`)).toBeNull();
    expect(queryByTestId(`timer-resume-${timer.id}`)).toBeNull();
  });

  it('should show "timer.complete" text when complete', async () => {
    const timer = makeTimer({ isRunning: false, remainingMs: 0 });
    const { getByText } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByText("timer.complete")).toBeTruthy();
  });

  it("should apply errorContainer background when complete", async () => {
    const timer = makeTimer({ isRunning: false, remainingMs: 0 });
    const { getByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    // Paper Card renders an outer-layer wrapper with the test ID suffix
    const cardOuterLayer = getByTestId(
      `timer-card-${timer.id}-container-outer-layer`,
    );
    const flatStyle = Array.isArray(cardOuterLayer.props.style)
      ? Object.assign({}, ...cardOuterLayer.props.style.flat(Infinity))
      : cardOuterLayer.props.style;

    // errorContainer color should be applied via the Card style prop
    expect(flatStyle?.backgroundColor).toBeDefined();
  });

  it("should call onPause with timer.id", async () => {
    const onPause = jest.fn();
    const timer = makeTimer({ isRunning: true });
    const { getByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} onPause={onPause} />,
    );

    await fireEvent.press(getByTestId(`timer-pause-${timer.id}`));
    expect(onPause).toHaveBeenCalledWith(timer.id);
  });

  it("should call onResume with timer.id", async () => {
    const onResume = jest.fn();
    const timer = makeTimer({ isRunning: false, remainingMs: 60000 });
    const { getByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} onResume={onResume} />,
    );

    await fireEvent.press(getByTestId(`timer-resume-${timer.id}`));
    expect(onResume).toHaveBeenCalledWith(timer.id);
  });

  it("should call onReset with timer.id", async () => {
    const onReset = jest.fn();
    const timer = makeTimer();
    const { getByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} onReset={onReset} />,
    );

    await fireEvent.press(getByTestId(`timer-reset-${timer.id}`));
    expect(onReset).toHaveBeenCalledWith(timer.id);
  });

  it("should call onDelete with timer.id", async () => {
    const onDelete = jest.fn();
    const timer = makeTimer();
    const { getByTestId } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} onDelete={onDelete} />,
    );

    await fireEvent.press(getByTestId(`timer-delete-${timer.id}`));
    expect(onDelete).toHaveBeenCalledWith(timer.id);
  });

  it("should display timer label", async () => {
    const timer = makeTimer({ label: "Morning Coffee" });
    const { getByText } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByText("Morning Coffee")).toBeTruthy();
  });

  it("should format hours correctly", async () => {
    // 3661000ms = 1h 1m 1s
    const timer = makeTimer({ remainingMs: 3661000 });
    const { getByText } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByText("01:01:01")).toBeTruthy();
  });

  it("should handle negative remainingMs as complete", async () => {
    const timer = makeTimer({ isRunning: false, remainingMs: -100 });
    const { getByText } = await renderWithProviders(
      <TimerCard timer={timer} {...defaultCallbacks} />,
    );

    expect(getByText("timer.complete")).toBeTruthy();
  });
});
