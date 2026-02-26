import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { NumpadInput } from "../../../src/features/timer/components/NumpadInput";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("NumpadInput", () => {
  const onStart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render numpad with digits 0-9", async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    for (let i = 0; i <= 9; i++) {
      expect(getByTestId(`numpad-${i}`)).toBeTruthy();
    }
  });

  it("should render display showing 00h 00m 00s initially", async () => {
    const { getAllByText, getByText } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    // "00" appears three times: hours, minutes, seconds
    expect(getAllByText("00")).toHaveLength(3);
    expect(getByText("h ")).toBeTruthy();
    expect(getByText("m ")).toBeTruthy();
    expect(getByText("s")).toBeTruthy();
  });

  it("should update display when digit buttons are pressed", async () => {
    const { getByTestId, getAllByText, getByText } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    // Press "1", "3", "0" → digits = "130" → padded "000130" → 00h 01m 30s
    await fireEvent.press(getByTestId("numpad-1"));
    await fireEvent.press(getByTestId("numpad-3"));
    await fireEvent.press(getByTestId("numpad-0"));

    // Hours: "00", Minutes: "01", Seconds: "30"
    // "00" appears as the hours value
    const zeros = getAllByText("00");
    expect(zeros.length).toBeGreaterThanOrEqual(1);
    expect(getByText("01")).toBeTruthy();
    expect(getByText("30")).toBeTruthy();
  });

  it("should handle backspace to delete last digit", async () => {
    const { getByTestId, getAllByText } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    await fireEvent.press(getByTestId("numpad-1"));
    await fireEvent.press(getByTestId("numpad-5"));
    // digits = "15" → 00h 00m 15s

    await fireEvent.press(getByTestId("numpad-backspace"));
    // digits = "1" → 00h 00m 01s

    // After backspace: "000001" → 00h 00m 01s
    expect(getAllByText("00").length).toBeGreaterThanOrEqual(2);
  });

  it("should not allow more than 6 digits", async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    // Press 7 digits: only 6 should be accepted
    await fireEvent.press(getByTestId("numpad-1"));
    await fireEvent.press(getByTestId("numpad-2"));
    await fireEvent.press(getByTestId("numpad-3"));
    await fireEvent.press(getByTestId("numpad-4"));
    await fireEvent.press(getByTestId("numpad-5"));
    await fireEvent.press(getByTestId("numpad-6"));

    // After 6 digits, digit buttons should be disabled
    const button7 = getByTestId("numpad-7");
    expect(button7.props.accessibilityState?.disabled).toBe(true);
  });

  it('should call onStart with correct ms when start pressed (e.g., "130" -> 90000ms = 1m30s)', async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    // digits = "130" → padded = "000130" → h=0, m=1, s=30
    // ms = (0*3600 + 1*60 + 30) * 1000 = 90000
    await fireEvent.press(getByTestId("numpad-1"));
    await fireEvent.press(getByTestId("numpad-3"));
    await fireEvent.press(getByTestId("numpad-0"));
    await fireEvent.press(getByTestId("numpad-start"));

    expect(onStart).toHaveBeenCalledWith(90000);
  });

  it("should disable start when total is 0", async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    const startButton = getByTestId("numpad-start");
    expect(startButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("should handle preset buttons (1, 5, 10, 30 min)", async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    await fireEvent.press(getByTestId("preset-1"));
    expect(onStart).toHaveBeenCalledWith(60000);

    onStart.mockClear();
    await fireEvent.press(getByTestId("preset-5"));
    expect(onStart).toHaveBeenCalledWith(300000);

    onStart.mockClear();
    await fireEvent.press(getByTestId("preset-10"));
    expect(onStart).toHaveBeenCalledWith(600000);

    onStart.mockClear();
    await fireEvent.press(getByTestId("preset-30"));
    expect(onStart).toHaveBeenCalledWith(1800000);
  });

  it("should reset digits after start is pressed", async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    await fireEvent.press(getByTestId("numpad-5"));
    await fireEvent.press(getByTestId("numpad-start"));

    // After pressing start, digits should reset, start button disabled again
    const startButton = getByTestId("numpad-start");
    expect(startButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("should disable backspace when no digits entered", async () => {
    const { getByTestId } = await renderWithProviders(
      <NumpadInput onStart={onStart} />,
    );

    const backspace = getByTestId("numpad-backspace");
    expect(backspace.props.accessibilityState?.disabled).toBe(true);
  });
});
