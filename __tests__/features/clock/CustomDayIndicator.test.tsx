import { render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { CustomDayIndicator } from "../../../src/features/clock/components/CustomDayIndicator";

let mockLanguage = "en";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      get language() {
        return mockLanguage;
      },
    },
  }),
}));

describe("CustomDayIndicator", () => {
  function renderWithPaper(ui: React.ReactElement) {
    return render(<PaperProvider>{ui}</PaperProvider>);
  }

  beforeEach(() => {
    mockLanguage = "en";
  });

  it("should display date in English format (M/d (EEE))", async () => {
    // Saturday, February 28, 2026
    const realTimeMs = new Date(2026, 1, 28, 10, 0, 0).getTime();
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator realTimeMs={realTimeMs} />,
    );
    expect(getByText("2/28 (Sat)")).toBeTruthy();
  });

  it("should update when date changes", async () => {
    const realTimeMs1 = new Date(2026, 0, 15, 10, 0, 0).getTime();
    const { getByText, rerender } = await renderWithPaper(
      <CustomDayIndicator realTimeMs={realTimeMs1} />,
    );
    expect(getByText("1/15 (Thu)")).toBeTruthy();

    const realTimeMs2 = new Date(2026, 11, 25, 10, 0, 0).getTime();
    await rerender(
      <PaperProvider>
        <CustomDayIndicator realTimeMs={realTimeMs2} />
      </PaperProvider>,
    );
    expect(getByText("12/25 (Fri)")).toBeTruthy();
  });

  it("should handle epoch zero (1970/1/1)", async () => {
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator realTimeMs={0} />,
    );
    // 1970-01-01 is a Thursday in UTC; local time display depends on timezone
    // Use Date to get what the component would produce
    const expected = "1/1 (Thu)";
    expect(getByText(expected)).toBeTruthy();
  });

  it("should display date in Japanese format when language is ja", async () => {
    mockLanguage = "ja";
    // Saturday, February 28, 2026
    const realTimeMs = new Date(2026, 1, 28, 10, 0, 0).getTime();
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator realTimeMs={realTimeMs} />,
    );
    expect(getByText("2\u670828\u65e5 (\u571f)")).toBeTruthy();
  });

  it("should use English format for non-ja languages", async () => {
    mockLanguage = "fr";
    const realTimeMs = new Date(2026, 1, 28, 10, 0, 0).getTime();
    const { getByText } = await renderWithPaper(
      <CustomDayIndicator realTimeMs={realTimeMs} />,
    );
    // Non-ja languages default to English format
    expect(getByText("2/28 (Sat)")).toBeTruthy();
  });
});
