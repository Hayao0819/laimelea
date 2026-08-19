let mockLocales: Array<{ languageCode: string }> = [];

jest.mock("react-native-localize", () => ({
  getLocales: () => mockLocales,
}));

jest.mock("i18next", () => {
  const instance = {
    use: jest.fn(),
    init: jest.fn(),
  };
  instance.use.mockReturnValue(instance);
  return instance;
});

jest.mock("react-i18next", () => ({
  initReactI18next: {},
}));

import i18n, { resolveLanguage } from "../../../src/core/i18n";

const mockI18n = jest.requireMock("i18next") as {
  use: jest.Mock;
  init: jest.Mock;
};

describe("i18n", () => {
  beforeEach(() => {
    mockLocales = [];
  });

  it("uses the first supported system language for automatic settings", () => {
    mockLocales = [{ languageCode: "de" }, { languageCode: "en" }];

    expect(resolveLanguage("auto")).toBe("en");
  });

  it("falls back to Japanese when no supported system language exists", () => {
    mockLocales = [{ languageCode: "fr" }];

    expect(resolveLanguage("auto")).toBe("ja");
    expect(resolveLanguage("unsupported")).toBe("ja");
  });

  it("uses an explicitly selected supported language", () => {
    mockLocales = [{ languageCode: "ja" }];

    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("ja")).toBe("ja");
  });

  it("initializes i18next with the configured resource bundle", () => {
    expect(i18n).toBe(mockI18n);
    expect(mockI18n.use).toHaveBeenCalledTimes(2);
    expect(mockI18n.init).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackLng: "ja" }),
    );
  });

  it("exposes a synchronous language detector to i18next", () => {
    const detector = mockI18n.use.mock.calls[0][0] as {
      type: string;
      async: boolean;
      detect: () => string;
      init: () => void;
      cacheUserLanguage: () => void;
    };
    mockLocales = [{ languageCode: "en" }];

    expect(detector.type).toBe("languageDetector");
    expect(detector.async).toBe(false);
    expect(detector.detect()).toBe("en");
    expect(detector.init()).toBeUndefined();
    expect(detector.cacheUserLanguage()).toBeUndefined();
  });
});
