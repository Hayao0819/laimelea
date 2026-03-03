// Import triggers side-effect strategy registrations
import "../../../src/features/alarm/strategies";

import { render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { DismissalPreview } from "../../../src/features/alarm/components/DismissalPreview";
import {
  clearStrategies,
  getAllStrategies,
  registerStrategy,
} from "../../../src/features/alarm/strategies/registry";
import type { DismissalStrategy } from "../../../src/features/alarm/strategies/types";

jest.mock("react-native-shake", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
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

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("DismissalPreview", () => {
  it("should render preview label", async () => {
    const { getByText } = await renderWithPaper(
      <DismissalPreview method="simple" difficulty={1} />,
    );
    expect(getByText("alarm.dismissalPreview")).toBeTruthy();
  });

  it("should render SimpleDismissal for simple method", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview method="simple" difficulty={1} />,
    );
    expect(getByTestId("dismissal-simple")).toBeTruthy();
  });

  it("should render MathDismissal for math method", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview method="math" difficulty={2} />,
    );
    expect(getByTestId("dismissal-math")).toBeTruthy();
  });

  it("should render ShakeDismissal for shake method", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview method="shake" difficulty={1} />,
    );
    expect(getByTestId("dismissal-shake")).toBeTruthy();
  });

  it("should set pointerEvents to none on preview container", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview method="simple" difficulty={1} />,
    );
    const preview = getByTestId("dismissal-preview");
    expect(preview.props.pointerEvents).toBe("none");
  });

  it("should have accessibility label with method name", async () => {
    const { getByTestId } = await renderWithPaper(
      <DismissalPreview method="simple" difficulty={1} />,
    );
    const preview = getByTestId("dismissal-preview");
    expect(preview.props.accessibilityLabel).toContain(
      "alarm.dismissalPreviewOf",
    );
  });

  it("should return null for unknown strategy", async () => {
    const savedStrategies: DismissalStrategy[] = [];
    getAllStrategies().forEach((s) => savedStrategies.push(s));
    clearStrategies();

    const { queryByTestId } = await renderWithPaper(
      <DismissalPreview method={"unknown" as never} difficulty={1} />,
    );
    expect(queryByTestId("dismissal-preview")).toBeNull();

    // Restore strategies
    savedStrategies.forEach((s) => registerStrategy(s));
  });
});
