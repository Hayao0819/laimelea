import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { CustomDayIndicator } from "../../../src/features/clock/components/CustomDayIndicator";
import type { CustomTimeValue } from "../../../src/models/CustomTime";

describe("CustomDayIndicator", () => {
  function renderWithPaper(ui: React.ReactElement) {
    return render(<PaperProvider>{ui}</PaperProvider>);
  }

  it('should render with testID "custom-day-indicator"', async () => {
    const customTime: CustomTimeValue = {
      day: 1,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    const { getByTestId } = await renderWithPaper(
      <CustomDayIndicator customTime={customTime} />,
    );
    expect(getByTestId("custom-day-indicator")).toBeTruthy();
  });

  it("should display formatted custom day text using formatCustomDay", async () => {
    const customTime: CustomTimeValue = {
      day: 5,
      hours: 14,
      minutes: 30,
      seconds: 0,
    };
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator customTime={customTime} />,
    );
    // formatCustomDay returns "Day {day}"
    expect(getByText("Day 5")).toBeTruthy();
  });

  it("should update when day changes", async () => {
    const customTime1: CustomTimeValue = {
      day: 3,
      hours: 10,
      minutes: 0,
      seconds: 0,
    };
    const { getByText, rerender } = await renderWithPaper(
      <CustomDayIndicator customTime={customTime1} />,
    );
    expect(getByText("Day 3")).toBeTruthy();

    const customTime2: CustomTimeValue = {
      day: 42,
      hours: 10,
      minutes: 0,
      seconds: 0,
    };
    await rerender(
      <PaperProvider>
        <CustomDayIndicator customTime={customTime2} />
      </PaperProvider>,
    );
    expect(getByText("Day 42")).toBeTruthy();
  });

  it("should display day 0 correctly", async () => {
    const customTime: CustomTimeValue = {
      day: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator customTime={customTime} />,
    );
    expect(getByText("Day 0")).toBeTruthy();
  });

  it("should display large day numbers", async () => {
    const customTime: CustomTimeValue = {
      day: 9999,
      hours: 23,
      minutes: 59,
      seconds: 59,
    };
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator customTime={customTime} />,
    );
    expect(getByText("Day 9999")).toBeTruthy();
  });
});
