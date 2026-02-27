import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { useTimers } from "../../../src/hooks/useTimers";
import { CountdownTimer } from "../../../src/features/timer/components/CountdownTimer";
import type { TimerState } from "../../../src/models/Timer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

const mockAddTimer = jest.fn();
const mockDeleteTimer = jest.fn();
const mockPauseTimer = jest.fn();
const mockResumeTimer = jest.fn();
const mockResetTimer = jest.fn();

jest.mock("../../../src/hooks/useTimers", () => ({
  useTimers: jest.fn(() => ({
    timers: [],
    addTimer: mockAddTimer,
    deleteTimer: mockDeleteTimer,
    pauseTimer: mockPauseTimer,
    resumeTimer: mockResumeTimer,
    resetTimer: mockResetTimer,
  })),
}));

const mockUseTimers = useTimers as jest.MockedFunction<typeof useTimers>;

jest.mock("../../../src/features/timer/components/NumpadInput", () => ({
  NumpadInput: ({ onStart }: { onStart: (ms: number) => void }) => {
    const { View, Button } = require("react-native");
    return (
      <View testID="numpad-mock">
        <Button
          testID="numpad-start"
          title="Start"
          onPress={() => onStart(60000)}
        />
      </View>
    );
  },
}));

jest.mock("../../../src/features/timer/components/TimerCard", () => ({
  TimerCard: ({ timer }: { timer: TimerState }) => {
    const { View, Text } = require("react-native");
    return (
      <View testID={`timer-card-mock-${timer.id}`}>
        <Text>{timer.id}</Text>
      </View>
    );
  },
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
    durationMs: 300000,
    remainingMs: 180000,
    isRunning: true,
    startedAt: Date.now(),
    pausedElapsedMs: 0,
    ...overrides,
  };
}

function createMockTimersReturn(
  overrides: Partial<ReturnType<typeof useTimers>> = {},
): ReturnType<typeof useTimers> {
  return {
    timers: [],
    addTimer: mockAddTimer,
    deleteTimer: mockDeleteTimer,
    pauseTimer: mockPauseTimer,
    resumeTimer: mockResumeTimer,
    resetTimer: mockResetTimer,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("CountdownTimer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTimers.mockReturnValue(createMockTimersReturn());
  });

  it('should show "timer.noTimers" text when no timers exist', async () => {
    const { getByTestId, getByText } = await renderWithProviders(
      <CountdownTimer />,
    );

    expect(getByTestId("no-timers-text")).toBeTruthy();
    expect(getByText("timer.noTimers")).toBeTruthy();
  });

  it("should render NumpadInput", async () => {
    const { getByTestId } = await renderWithProviders(<CountdownTimer />);
    expect(getByTestId("numpad-mock")).toBeTruthy();
  });

  it("should render timer list when timers exist", async () => {
    const timers = [makeTimer({ id: "t-1" }), makeTimer({ id: "t-2" })];
    mockUseTimers.mockReturnValue(createMockTimersReturn({ timers }));

    const { getByTestId, queryByTestId } = await renderWithProviders(
      <CountdownTimer />,
    );

    expect(getByTestId("timer-card-mock-t-1")).toBeTruthy();
    expect(getByTestId("timer-card-mock-t-2")).toBeTruthy();
    expect(queryByTestId("no-timers-text")).toBeNull();
  });

  it("should render TimerCard for each timer", async () => {
    const timers = [
      makeTimer({ id: "alpha" }),
      makeTimer({ id: "beta" }),
      makeTimer({ id: "gamma" }),
    ];
    mockUseTimers.mockReturnValue(createMockTimersReturn({ timers }));

    const { getByTestId } = await renderWithProviders(<CountdownTimer />);

    expect(getByTestId("timer-card-mock-alpha")).toBeTruthy();
    expect(getByTestId("timer-card-mock-beta")).toBeTruthy();
    expect(getByTestId("timer-card-mock-gamma")).toBeTruthy();
  });

  it("should call addTimer when NumpadInput onStart is triggered", async () => {
    const { getByTestId } = await renderWithProviders(<CountdownTimer />);

    await fireEvent.press(getByTestId("numpad-start"));

    expect(mockAddTimer).toHaveBeenCalledWith(60000);
    expect(mockAddTimer).toHaveBeenCalledTimes(1);
  });

  it("should show completion snackbar when timer completes", async () => {
    const runningTimer = makeTimer({
      id: "completing",
      isRunning: true,
      remainingMs: 1000,
    });

    mockUseTimers.mockReturnValue(
      createMockTimersReturn({ timers: [runningTimer] }),
    );

    const { rerender, getByText } = await renderWithProviders(
      <CountdownTimer />,
    );

    // Timer completes: isRunning transitions to false, remainingMs <= 0
    const completedTimer = makeTimer({
      id: "completing",
      isRunning: false,
      remainingMs: 0,
    });

    mockUseTimers.mockReturnValue(
      createMockTimersReturn({ timers: [completedTimer] }),
    );

    await rerender(
      <PaperProvider>
        <CountdownTimer />
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(getByText("timer.complete")).toBeTruthy();
    });
  });
});
