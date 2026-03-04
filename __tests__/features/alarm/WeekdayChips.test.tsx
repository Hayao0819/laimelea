import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { WeekdayChips } from "../../../src/features/alarm/components/WeekdayChips";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("WeekdayChips", () => {
  it("should render all 7 weekday chips", async () => {
    const onDaysChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <WeekdayChips selectedDays={[]} onDaysChange={onDaysChange} />,
    );

    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`weekday-chip-${i}`)).toBeTruthy();
    }
  });

  it("should display i18n weekday names", async () => {
    const onDaysChange = jest.fn();
    const { getByText } = await renderWithPaper(
      <WeekdayChips selectedDays={[]} onDaysChange={onDaysChange} />,
    );

    expect(getByText("weekday.sun")).toBeTruthy();
    expect(getByText("weekday.mon")).toBeTruthy();
    expect(getByText("weekday.tue")).toBeTruthy();
    expect(getByText("weekday.wed")).toBeTruthy();
    expect(getByText("weekday.thu")).toBeTruthy();
    expect(getByText("weekday.fri")).toBeTruthy();
    expect(getByText("weekday.sat")).toBeTruthy();
  });

  it("should toggle a day on when pressing an unselected chip", async () => {
    const onDaysChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <WeekdayChips selectedDays={[]} onDaysChange={onDaysChange} />,
    );

    await fireEvent.press(getByTestId("weekday-chip-1")); // Monday
    expect(onDaysChange).toHaveBeenCalledWith([1]);
  });

  it("should toggle a day off when pressing a selected chip", async () => {
    const onDaysChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <WeekdayChips selectedDays={[1, 3]} onDaysChange={onDaysChange} />,
    );

    await fireEvent.press(getByTestId("weekday-chip-1")); // Monday (deselect)
    expect(onDaysChange).toHaveBeenCalledWith([3]);
  });

  it("should support multiple selections", async () => {
    const onDaysChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <WeekdayChips selectedDays={[0, 6]} onDaysChange={onDaysChange} />,
    );

    await fireEvent.press(getByTestId("weekday-chip-3")); // Wednesday
    expect(onDaysChange).toHaveBeenCalledWith([0, 3, 6]);
  });

  it("should maintain sorted order when adding a day", async () => {
    const onDaysChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <WeekdayChips selectedDays={[1, 5]} onDaysChange={onDaysChange} />,
    );

    await fireEvent.press(getByTestId("weekday-chip-3"));
    expect(onDaysChange).toHaveBeenCalledWith([1, 3, 5]);
  });

  it("should render the container with testID", async () => {
    const onDaysChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <WeekdayChips selectedDays={[]} onDaysChange={onDaysChange} />,
    );

    expect(getByTestId("weekday-chips")).toBeTruthy();
  });
});
