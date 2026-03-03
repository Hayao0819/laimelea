import { fireEvent,render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { SimpleDismissal } from "../../../../src/features/alarm/components/dismissal/SimpleDismissal";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderComponent(
  props: Partial<React.ComponentProps<typeof SimpleDismissal>> = {},
) {
  const defaultProps = {
    onDismiss: jest.fn(),
    onSnooze: jest.fn(),
    difficulty: 1,
    canSnooze: true,
  };
  return render(
    <PaperProvider>
      <SimpleDismissal {...defaultProps} {...props} />
    </PaperProvider>,
  );
}

describe("SimpleDismissal", () => {
  it("should render dismiss button", async () => {
    const { getByTestId } = await renderComponent();
    expect(getByTestId("dismissal-simple")).toBeTruthy();
    expect(getByTestId("dismiss-button")).toBeTruthy();
  });

  it("should call onDismiss when dismiss button is pressed", async () => {
    const onDismiss = jest.fn();
    const { getByTestId } = await renderComponent({ onDismiss });
    fireEvent.press(getByTestId("dismiss-button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should show snooze button when canSnooze is true", async () => {
    const { getByTestId } = await renderComponent({ canSnooze: true });
    expect(getByTestId("snooze-button")).toBeTruthy();
  });

  it("should hide snooze button when canSnooze is false", async () => {
    const { queryByTestId } = await renderComponent({ canSnooze: false });
    expect(queryByTestId("snooze-button")).toBeNull();
  });

  it("should call onSnooze when snooze button is pressed", async () => {
    const onSnooze = jest.fn();
    const { getByTestId } = await renderComponent({ onSnooze });
    fireEvent.press(getByTestId("snooze-button"));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });
});
