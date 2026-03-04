import { render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { DismissalPreview } from "../../../src/features/alarm/components/DismissalPreview";

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

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("DismissalPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render preview button", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview alarm={{ dismissalMethod: "simple" }} />,
    );
    expect(getByTestId("preview-button")).toBeTruthy();
  });

  it("should display showPreview text", async () => {
    const { getByText } = await renderWithPaper(
      <DismissalPreview alarm={{ dismissalMethod: "simple" }} />,
    );
    expect(getByText("alarm.showPreview")).toBeTruthy();
  });

  it("should have accessibility label", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview alarm={{ dismissalMethod: "simple" }} />,
    );
    const button = getByTestId("preview-button");
    expect(button.props.accessibilityLabel).toBe("alarm.showPreview");
  });

  it("should navigate to AlarmFiring with isPreview when pressed", async () => {
    const alarm = {
      id: "test-alarm",
      dismissalMethod: "math" as const,
      mathDifficulty: 2 as const,
    };
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview alarm={alarm} />,
    );

    const { fireEvent } = require("@testing-library/react-native");
    await fireEvent.press(getByTestId("preview-button"));

    expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
      alarmId: "test-alarm",
      isPreview: true,
      alarm,
    });
  });

  it("should use 'preview' as alarmId when alarm has no id", async () => {
    const alarm = { dismissalMethod: "simple" as const };
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview alarm={alarm} />,
    );

    const { fireEvent } = require("@testing-library/react-native");
    await fireEvent.press(getByTestId("preview-button"));

    expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
      alarmId: "preview",
      isPreview: true,
      alarm,
    });
  });
});
