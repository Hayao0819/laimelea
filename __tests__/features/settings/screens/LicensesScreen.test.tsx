import { render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { spacing } from "../../../../src/app/spacing";
import { LicensesScreen } from "../../../../src/features/settings/screens/LicensesScreen";

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

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(() => Promise.resolve()),
}));

jest.mock(
  "../../../../src/generated/licenses.json",
  () => [
    {
      name: "react",
      version: "18.0.0",
      license: "MIT",
      repository: "https://github.com/facebook/react",
    },
    {
      name: "jotai",
      version: "2.0.0",
      license: "MIT",
      repository: "https://github.com/pmndrs/jotai",
    },
  ],
  { virtual: true },
);

function renderWithProviders() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 16, bottom: 24, left: 12 },
      }}
    >
      <PaperProvider>
        <LicensesScreen />
      </PaperProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("LicensesScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("licenses-screen")).toBeTruthy();
  });

  it("adds the bottom safe-area inset to the list padding", () => {
    const { getByTestId } = renderWithProviders();

    expect(getByTestId("licenses-screen").props.contentContainerStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paddingBottom: spacing.xl + 24,
          paddingLeft: 12,
          paddingRight: 16,
        }),
      ]),
    );
  });

  it("should display license entries from JSON", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("react")).toBeTruthy();
    expect(getByText("jotai")).toBeTruthy();
  });
});
