import { fireEvent,render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { AlarmTimePicker } from "../../../src/features/alarm/components/AlarmTimePicker";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

function renderPicker(
  props: Partial<React.ComponentProps<typeof AlarmTimePicker>> = {},
) {
  const defaultProps: React.ComponentProps<typeof AlarmTimePicker> = {
    value: { hours: 0, minutes: 0 },
    timeSystem: "custom",
    cycleLengthMinutes: 1560, // 26h
    onChange: jest.fn(),
    ...props,
  };
  return render(
    <PaperProvider>
      <AlarmTimePicker {...defaultProps} />
    </PaperProvider>,
  );
}

describe("AlarmTimePicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with testID "alarm-time-picker"', async () => {
    const { getByTestId } = await renderPicker();
    expect(getByTestId("alarm-time-picker")).toBeTruthy();
  });

  it("should display hours and minutes padded to 2 digits", async () => {
    const { getByTestId } = await renderPicker({
      value: { hours: 3, minutes: 7 },
    });

    const hoursInput = getByTestId("hours-input");
    const minutesInput = getByTestId("minutes-input");
    expect(hoursInput.props.value).toBe("03");
    expect(minutesInput.props.value).toBe("07");
  });

  it("should update hours on text input change (clamped to maxHours)", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      timeSystem: "custom",
      cycleLengthMinutes: 1560, // maxHours = 25
      onChange,
    });

    // Input a value within range
    await fireEvent.changeText(getByTestId("hours-input"), "20");
    expect(onChange).toHaveBeenCalledWith({ hours: 20, minutes: 30 });

    onChange.mockClear();

    // Input a value exceeding maxHours (25) - should be clamped
    await fireEvent.changeText(getByTestId("hours-input"), "30");
    expect(onChange).toHaveBeenCalledWith({ hours: 25, minutes: 30 });
  });

  it("should update minutes on text input change (clamped to 0-59)", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 10, minutes: 0 },
      onChange,
    });

    // Valid minutes
    await fireEvent.changeText(getByTestId("minutes-input"), "45");
    expect(onChange).toHaveBeenCalledWith({ hours: 10, minutes: 45 });

    onChange.mockClear();

    // Exceeding 59 - should be clamped
    await fireEvent.changeText(getByTestId("minutes-input"), "99");
    expect(onChange).toHaveBeenCalledWith({ hours: 10, minutes: 59 });
  });

  it("should set to 0 when NaN input", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      onChange,
    });

    // NaN hours
    await fireEvent.changeText(getByTestId("hours-input"), "abc");
    expect(onChange).toHaveBeenCalledWith({ hours: 0, minutes: 30 });

    onChange.mockClear();

    // NaN minutes
    await fireEvent.changeText(getByTestId("minutes-input"), "");
    expect(onChange).toHaveBeenCalledWith({ hours: 5, minutes: 0 });
  });

  it("should calculate maxHours correctly for custom time system (cycleLengthMinutes / 60 - 1)", async () => {
    const onChange = jest.fn();
    // 1560 min = 26h, maxHours = 25
    const { getByTestId } = await renderPicker({
      value: { hours: 0, minutes: 0 },
      timeSystem: "custom",
      cycleLengthMinutes: 1560,
      onChange,
    });

    // Input exactly maxHours (25) - should accept
    await fireEvent.changeText(getByTestId("hours-input"), "25");
    expect(onChange).toHaveBeenCalledWith({ hours: 25, minutes: 0 });

    onChange.mockClear();

    // Input above maxHours - should clamp to 25
    await fireEvent.changeText(getByTestId("hours-input"), "26");
    expect(onChange).toHaveBeenCalledWith({ hours: 25, minutes: 0 });
  });

  it("should use maxHours=23 for 24h time system", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 0, minutes: 0 },
      timeSystem: "24h",
      cycleLengthMinutes: 1560,
      onChange,
    });

    // Input 23 - should accept
    await fireEvent.changeText(getByTestId("hours-input"), "23");
    expect(onChange).toHaveBeenCalledWith({ hours: 23, minutes: 0 });

    onChange.mockClear();

    // Input 24 - should clamp to 23
    await fireEvent.changeText(getByTestId("hours-input"), "24");
    expect(onChange).toHaveBeenCalledWith({ hours: 23, minutes: 0 });
  });

  it('should display max hours label "(0-Xh)"', async () => {
    // Custom time: 1560 min = 26h, maxHours = 25
    const { getByText, rerender } = await renderPicker({
      timeSystem: "custom",
      cycleLengthMinutes: 1560,
    });
    expect(getByText("(0–25h)")).toBeTruthy();

    // 24h system: maxHours = 23
    await rerender(
      <PaperProvider>
        <AlarmTimePicker
          value={{ hours: 0, minutes: 0 }}
          timeSystem="24h"
          cycleLengthMinutes={1560}
          onChange={jest.fn()}
        />
      </PaperProvider>,
    );
    expect(getByText("(0–23h)")).toBeTruthy();
  });
});
