import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
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
    <PaperProvider>
      <LicensesScreen />
    </PaperProvider>,
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

  it("should display license entries from JSON", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("react")).toBeTruthy();
    expect(getByText("jotai")).toBeTruthy();
  });
});
