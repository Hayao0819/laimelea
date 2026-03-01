import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { TimerScreen } from "../../../src/features/timer/screens/TimerScreen";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../src/features/timer/components/CountdownTimer", () => ({
  CountdownTimer: () => {
    const { View } = require("react-native");
    return <View testID="countdown-timer-mock" />;
  },
}));

jest.mock("../../../src/features/timer/components/Stopwatch", () => ({
  Stopwatch: () => {
    const { View } = require("react-native");
    return <View testID="stopwatch-mock" />;
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("TimerScreen", () => {
  it('should render segmented buttons with "timer.countdown" and "timer.stopwatch"', async () => {
    const { getByText } = await renderWithProviders(<TimerScreen />);
    expect(getByText("timer.countdown")).toBeTruthy();
    expect(getByText("timer.stopwatch")).toBeTruthy();
  });

  it("should default to countdown tab", async () => {
    const { getByTestId, queryByTestId } = await renderWithProviders(
      <TimerScreen />,
    );
    expect(getByTestId("countdown-timer-mock")).toBeTruthy();
    expect(queryByTestId("stopwatch-mock")).toBeNull();
  });

  it("should switch to stopwatch when stopwatch button pressed", async () => {
    const { getByText, getByTestId, queryByTestId } = await renderWithProviders(
      <TimerScreen />,
    );

    // Initially countdown
    expect(getByTestId("countdown-timer-mock")).toBeTruthy();
    expect(queryByTestId("stopwatch-mock")).toBeNull();

    // Press stopwatch button
    await fireEvent.press(getByText("timer.stopwatch"));

    // Now stopwatch should be visible
    expect(getByTestId("stopwatch-mock")).toBeTruthy();
    expect(queryByTestId("countdown-timer-mock")).toBeNull();

    // Switch back to countdown
    await fireEvent.press(getByText("timer.countdown"));

    expect(getByTestId("countdown-timer-mock")).toBeTruthy();
    expect(queryByTestId("stopwatch-mock")).toBeNull();
  });
});
