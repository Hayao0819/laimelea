import { fireEvent, render } from "@testing-library/react-native";
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

  it("should update hours on blur (clamped to maxHours)", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      timeSystem: "custom",
      cycleLengthMinutes: 1560, // maxHours = 25
      onChange,
    });

    const hoursInput = getByTestId("hours-input");

    // Focus, type, then blur to trigger onChange
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "20");
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent(hoursInput, "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 20, minutes: 30 });

    onChange.mockClear();

    // Input a value exceeding maxHours (25) - should be clamped on blur
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "30");
    await fireEvent(hoursInput, "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 25, minutes: 30 });
  });

  it("should update minutes on blur (clamped to 0-59)", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 10, minutes: 0 },
      onChange,
    });

    const minutesInput = getByTestId("minutes-input");

    // Valid minutes
    await fireEvent(minutesInput, "focus");
    await fireEvent.changeText(minutesInput, "45");
    await fireEvent(minutesInput, "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 10, minutes: 45 });

    onChange.mockClear();

    // Exceeding 59 - should be clamped
    await fireEvent(minutesInput, "focus");
    await fireEvent.changeText(minutesInput, "99");
    await fireEvent(minutesInput, "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 10, minutes: 59 });
  });

  it("should set to 0 when NaN input on blur", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      onChange,
    });

    // NaN hours
    await fireEvent(getByTestId("hours-input"), "focus");
    await fireEvent.changeText(getByTestId("hours-input"), "abc");
    await fireEvent(getByTestId("hours-input"), "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 0, minutes: 30 });

    onChange.mockClear();

    // Empty string minutes
    await fireEvent(getByTestId("minutes-input"), "focus");
    await fireEvent.changeText(getByTestId("minutes-input"), "");
    await fireEvent(getByTestId("minutes-input"), "blur");
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

    const hoursInput = getByTestId("hours-input");

    // Input exactly maxHours (25) - should accept
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "25");
    await fireEvent(hoursInput, "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 25, minutes: 0 });

    onChange.mockClear();

    // Input above maxHours - should clamp to 25
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "26");
    await fireEvent(hoursInput, "blur");
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

    const hoursInput = getByTestId("hours-input");

    // Input 23 - should accept
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "23");
    await fireEvent(hoursInput, "blur");
    expect(onChange).toHaveBeenCalledWith({ hours: 23, minutes: 0 });

    onChange.mockClear();

    // Input 24 - should clamp to 23
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "24");
    await fireEvent(hoursInput, "blur");
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

  it("should not call onChange during editing (only on blur)", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      onChange,
    });

    const hoursInput = getByTestId("hours-input");

    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "1");
    await fireEvent.changeText(hoursInput, "12");

    expect(onChange).not.toHaveBeenCalled();

    await fireEvent(hoursInput, "blur");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("should show local text while editing", async () => {
    const { getByTestId } = await renderPicker({
      value: { hours: 5, minutes: 30 },
    });

    const hoursInput = getByTestId("hours-input");
    expect(hoursInput.props.value).toBe("05");

    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "1");
    expect(hoursInput.props.value).toBe("1");
  });

  it("should pad and clamp value on blur", async () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = await renderPicker({
      value: { hours: 0, minutes: 0 },
      onChange,
    });

    const hoursInput = getByTestId("hours-input");

    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "3");
    await fireEvent(hoursInput, "blur");

    expect(onChange).toHaveBeenCalledWith({ hours: 3, minutes: 0 });

    // Simulate parent updating value prop after onChange
    await rerender(
      <PaperProvider>
        <AlarmTimePicker
          value={{ hours: 3, minutes: 0 }}
          timeSystem="custom"
          cycleLengthMinutes={1560}
          onChange={onChange}
        />
      </PaperProvider>,
    );

    // After parent updates, the displayed value should be padded
    expect(getByTestId("hours-input").props.value).toBe("03");
  });

  it("should have selectTextOnFocus on both inputs", async () => {
    const { getByTestId } = await renderPicker();

    const hoursInput = getByTestId("hours-input");
    const minutesInput = getByTestId("minutes-input");

    expect(hoursInput.props.selectTextOnFocus).toBe(true);
    expect(minutesInput.props.selectTextOnFocus).toBe(true);
  });

  it("should sync from external value changes when not editing", async () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      onChange,
    });

    const hoursInput = getByTestId("hours-input");
    const minutesInput = getByTestId("minutes-input");
    expect(hoursInput.props.value).toBe("05");
    expect(minutesInput.props.value).toBe("30");

    // External value change while not editing
    await rerender(
      <PaperProvider>
        <AlarmTimePicker
          value={{ hours: 12, minutes: 45 }}
          timeSystem="custom"
          cycleLengthMinutes={1560}
          onChange={onChange}
        />
      </PaperProvider>,
    );

    expect(getByTestId("hours-input").props.value).toBe("12");
    expect(getByTestId("minutes-input").props.value).toBe("45");
  });

  it("should not overwrite editing field when external value changes", async () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = await renderPicker({
      value: { hours: 5, minutes: 30 },
      onChange,
    });

    const hoursInput = getByTestId("hours-input");

    // Start editing hours
    await fireEvent(hoursInput, "focus");
    await fireEvent.changeText(hoursInput, "1");

    // External value change for minutes while hours is being edited
    await rerender(
      <PaperProvider>
        <AlarmTimePicker
          value={{ hours: 8, minutes: 45 }}
          timeSystem="custom"
          cycleLengthMinutes={1560}
          onChange={onChange}
        />
      </PaperProvider>,
    );

    // Hours should keep local editing state
    expect(getByTestId("hours-input").props.value).toBe("1");
    // Minutes should sync since it's not being edited
    expect(getByTestId("minutes-input").props.value).toBe("45");
  });
});
