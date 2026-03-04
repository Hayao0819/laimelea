import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { RepeatPicker } from "../../../src/features/alarm/components/RepeatPicker";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("RepeatPicker", () => {
  it("should render with none mode by default when repeat is null", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <RepeatPicker repeat={null} onRepeatChange={onRepeatChange} />,
    );

    expect(getByTestId("repeat-picker-item")).toBeTruthy();
  });

  it("should show description for none mode", async () => {
    const onRepeatChange = jest.fn();
    const { getByText } = await renderWithPaper(
      <RepeatPicker repeat={null} onRepeatChange={onRepeatChange} />,
    );

    expect(getByText("alarm.repeatNone")).toBeTruthy();
  });

  it("should expand when item is pressed", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId, getByText } = await renderWithPaper(
      <RepeatPicker repeat={null} onRepeatChange={onRepeatChange} />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));

    await waitFor(() => {
      expect(getByText("alarm.repeatWeekdays")).toBeTruthy();
      expect(getByText("alarm.repeatInterval")).toBeTruthy();
    });
  });

  it("should switch to weekdays mode", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId, getByText } = await renderWithPaper(
      <RepeatPicker repeat={null} onRepeatChange={onRepeatChange} />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));
    await fireEvent.press(getByText("alarm.repeatWeekdays"));

    expect(onRepeatChange).toHaveBeenCalledWith({
      type: "weekdays",
      weekdays: [],
    });
  });

  it("should switch to interval mode", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId, getByText } = await renderWithPaper(
      <RepeatPicker repeat={null} onRepeatChange={onRepeatChange} />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));
    await fireEvent.press(getByText("alarm.repeatInterval"));

    expect(onRepeatChange).toHaveBeenCalledWith({
      type: "interval",
      intervalMs: 24 * 3_600_000,
    });
  });

  it("should switch back to none mode", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId, getByText } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "weekdays", weekdays: [1, 3] }}
        onRepeatChange={onRepeatChange}
      />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));
    await fireEvent.press(getByText("alarm.repeatNone"));

    expect(onRepeatChange).toHaveBeenCalledWith(null);
  });

  it("should show weekday chips when in weekdays mode", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "weekdays", weekdays: [1, 3] }}
        onRepeatChange={onRepeatChange}
      />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));

    await waitFor(() => {
      expect(getByTestId("weekday-chips")).toBeTruthy();
    });
  });

  it("should show interval input when in interval mode", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "interval", intervalMs: 24 * 3_600_000 }}
        onRepeatChange={onRepeatChange}
      />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));

    await waitFor(() => {
      expect(getByTestId("interval-input")).toBeTruthy();
    });
  });

  it("should reset repeat to null when all weekdays are deselected", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "weekdays", weekdays: [1] }}
        onRepeatChange={onRepeatChange}
      />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));

    await waitFor(() => {
      expect(getByTestId("weekday-chips")).toBeTruthy();
    });

    // Deselect the only selected day
    await fireEvent.press(getByTestId("weekday-chip-1"));

    expect(onRepeatChange).toHaveBeenCalledWith(null);
  });

  it("should update interval when text changes", async () => {
    const onRepeatChange = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "interval", intervalMs: 24 * 3_600_000 }}
        onRepeatChange={onRepeatChange}
      />,
    );

    await fireEvent.press(getByTestId("repeat-picker-item"));

    await waitFor(() => {
      expect(getByTestId("interval-input")).toBeTruthy();
    });

    await fireEvent.changeText(getByTestId("interval-input"), "12");

    expect(onRepeatChange).toHaveBeenCalledWith({
      type: "interval",
      intervalMs: 12 * 3_600_000,
    });
  });

  it("should show weekday names in description for weekdays repeat", async () => {
    const onRepeatChange = jest.fn();
    const { getByText } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "weekdays", weekdays: [1, 3] }}
        onRepeatChange={onRepeatChange}
      />,
    );

    expect(getByText("weekday.mon, weekday.wed")).toBeTruthy();
  });

  it("should show hours in description for interval repeat", async () => {
    const onRepeatChange = jest.fn();
    const { getByText } = await renderWithPaper(
      <RepeatPicker
        repeat={{ type: "interval", intervalMs: 48 * 3_600_000 }}
        onRepeatChange={onRepeatChange}
      />,
    );

    expect(getByText("48h")).toBeTruthy();
  });
});
