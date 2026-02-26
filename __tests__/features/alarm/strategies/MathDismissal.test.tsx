import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { MathDismissal } from "../../../../src/features/alarm/components/dismissal/MathDismissal";
import * as mathGen from "../../../../src/features/alarm/services/mathProblemGenerator";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderComponent(
  props: Partial<React.ComponentProps<typeof MathDismissal>> = {},
) {
  const defaultProps = {
    onDismiss: jest.fn(),
    onSnooze: jest.fn(),
    difficulty: 1,
    canSnooze: true,
  };
  return render(
    <PaperProvider>
      <MathDismissal {...defaultProps} {...props} />
    </PaperProvider>,
  );
}

describe("MathDismissal", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("should render math question and input", async () => {
    jest
      .spyOn(mathGen, "generateMathProblem")
      .mockReturnValue({ question: "3 + 4", answer: 7 });
    const { getByTestId } = await renderComponent();
    expect(getByTestId("dismissal-math")).toBeTruthy();
    expect(getByTestId("math-question")).toBeTruthy();
    expect(getByTestId("math-input")).toBeTruthy();
    expect(getByTestId("math-submit")).toBeTruthy();
  });

  it("should call onDismiss on correct answer", async () => {
    jest
      .spyOn(mathGen, "generateMathProblem")
      .mockReturnValue({ question: "3 + 4", answer: 7 });
    const onDismiss = jest.fn();
    const { getByTestId } = await renderComponent({ onDismiss });

    await act(async () => {
      fireEvent.changeText(getByTestId("math-input"), "7");
    });
    await act(async () => {
      fireEvent.press(getByTestId("math-submit"));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should show error on wrong answer", async () => {
    jest
      .spyOn(mathGen, "generateMathProblem")
      .mockReturnValue({ question: "3 + 4", answer: 7 });
    const onDismiss = jest.fn();
    const { getByTestId } = await renderComponent({ onDismiss });

    await act(async () => {
      fireEvent.changeText(getByTestId("math-input"), "5");
    });
    await act(async () => {
      fireEvent.press(getByTestId("math-submit"));
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(getByTestId("math-error")).toBeTruthy();
  });

  it("should generate new problem after wrong answer", async () => {
    const spy = jest
      .spyOn(mathGen, "generateMathProblem")
      .mockReturnValueOnce({ question: "3 + 4", answer: 7 })
      .mockReturnValueOnce({ question: "5 + 2", answer: 7 });

    const { getByTestId } = await renderComponent();

    await act(async () => {
      fireEvent.changeText(getByTestId("math-input"), "999");
    });
    await act(async () => {
      fireEvent.press(getByTestId("math-submit"));
    });

    // Initial call + wrong answer re-generation
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("should show snooze button when canSnooze is true", async () => {
    jest
      .spyOn(mathGen, "generateMathProblem")
      .mockReturnValue({ question: "1 + 1", answer: 2 });
    const { getByTestId } = await renderComponent({ canSnooze: true });
    expect(getByTestId("snooze-button")).toBeTruthy();
  });

  it("should hide snooze button when canSnooze is false", async () => {
    jest
      .spyOn(mathGen, "generateMathProblem")
      .mockReturnValue({ question: "1 + 1", answer: 2 });
    const { queryByTestId } = await renderComponent({ canSnooze: false });
    expect(queryByTestId("snooze-button")).toBeNull();
  });
});
