import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Linking } from "react-native";
import { PaperProvider } from "react-native-paper";
import { LegalScreen } from "../../../../src/features/settings/screens/LegalScreen";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

function renderWithProviders() {
  return render(
    <PaperProvider>
      <LegalScreen />
    </PaperProvider>,
  );
}

let openURLSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

afterEach(() => {
  openURLSpy.mockRestore();
});

describe("LegalScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("legal-screen")).toBeTruthy();
  });

  it("should display privacy policy item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("privacy-policy-item")).toBeTruthy();
  });

  it("should display licenses item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("licenses-item")).toBeTruthy();
  });

  it("should navigate to SettingsLicenses on licenses press", async () => {
    const { getByTestId } = await renderWithProviders();
    const licensesItem = getByTestId("licenses-item");

    await act(async () => {
      fireEvent.press(licensesItem);
    });

    expect(mockNavigate).toHaveBeenCalledWith("SettingsLicenses");
  });

  it("should open privacy policy URL on press", async () => {
    const { getByTestId } = await renderWithProviders();
    const privacyItem = getByTestId("privacy-policy-item");

    await act(async () => {
      fireEvent.press(privacyItem);
    });

    expect(openURLSpy).toHaveBeenCalledWith(
      "https://github.com/Hayao0819/laimelea/blob/master/docs/privacy-policy.md",
    );
  });

  it("should display MIT License item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("mit-license-item")).toBeTruthy();
  });

  it("should display MIT-SUSHI License item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("mit-sushi-license-item")).toBeTruthy();
  });

  it("should open MIT License URL on press", async () => {
    const { getByTestId } = await renderWithProviders();
    const mitItem = getByTestId("mit-license-item");

    await act(async () => {
      fireEvent.press(mitItem);
    });

    expect(openURLSpy).toHaveBeenCalledWith(
      "https://github.com/Hayao0819/laimelea/blob/master/LICENSE",
    );
  });

  it("should open MIT-SUSHI License URL on press", async () => {
    const { getByTestId } = await renderWithProviders();
    const sushiItem = getByTestId("mit-sushi-license-item");

    await act(async () => {
      fireEvent.press(sushiItem);
    });

    expect(openURLSpy).toHaveBeenCalledWith(
      "https://github.com/Hayao0819/laimelea/blob/master/LICENSE-SUSHI",
    );
  });
});
