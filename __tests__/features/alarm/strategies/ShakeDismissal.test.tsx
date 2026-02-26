import React from "react";
import { render, act } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { ShakeDismissal } from "../../../../src/features/alarm/components/dismissal/ShakeDismissal";

let shakeCallback: (() => void) | null = null;
const mockRemove = jest.fn();

jest.mock("react-native-shake", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn((cb: () => void) => {
      shakeCallback = cb;
      return { remove: mockRemove };
    }),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

function renderComponent(
  props: Partial<React.ComponentProps<typeof ShakeDismissal>> = {},
) {
  const defaultProps = {
    onDismiss: jest.fn(),
    onSnooze: jest.fn(),
    difficulty: 1,
    canSnooze: true,
  };
  return render(
    <PaperProvider>
      <ShakeDismissal {...defaultProps} {...props} />
    </PaperProvider>,
  );
}

describe("ShakeDismissal", () => {
  beforeEach(() => {
    shakeCallback = null;
    mockRemove.mockClear();
  });

  it("should render shake instructions and progress", async () => {
    const { getByTestId, getByText } = await renderComponent();
    expect(getByTestId("dismissal-shake")).toBeTruthy();
    expect(getByTestId("shake-progress")).toBeTruthy();
    expect(getByText("dismissal.shakeInstruction")).toBeTruthy();
  });

  it("should register shake listener on mount", async () => {
    const RNShake = require("react-native-shake").default;
    RNShake.addListener.mockClear();
    await renderComponent();
    expect(RNShake.addListener).toHaveBeenCalled();
  });

  it("should update shake count on shake event", async () => {
    const { getByTestId } = await renderComponent();
    expect(shakeCallback).not.toBeNull();

    await act(async () => {
      shakeCallback!();
    });

    expect(getByTestId("shake-count").props.children).toContain("1");
  });

  it("should call onDismiss after 3 shakes", async () => {
    const onDismiss = jest.fn();
    await renderComponent({ onDismiss });

    await act(async () => {
      shakeCallback!();
    });
    await act(async () => {
      shakeCallback!();
    });
    await act(async () => {
      shakeCallback!();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should cleanup listener on unmount", async () => {
    const { unmount } = await renderComponent();
    mockRemove.mockClear();
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("should show snooze button when canSnooze is true", async () => {
    const { getByTestId } = await renderComponent({ canSnooze: true });
    expect(getByTestId("snooze-button")).toBeTruthy();
  });
});
