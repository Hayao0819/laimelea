import React from "react";
import { render } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { ClockScreen } from "../../../src/features/clock/screens/ClockScreen";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { AppSettings } from "../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("react-native-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require("react");
  const createMockComponent = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  return {
    __esModule: true,
    default: createMockComponent("Svg"),
    Svg: createMockComponent("Svg"),
    Circle: createMockComponent("Circle"),
    Line: createMockComponent("Line"),
    Path: createMockComponent("Path"),
    G: createMockComponent("G"),
    Text: createMockComponent("SvgText"),
  };
});

const mockAnalogClock = jest.fn();
jest.mock("../../../src/features/clock/components/AnalogClock", () => ({
  AnalogClock: (props: Record<string, unknown>) => {
    mockAnalogClock(props);
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "analog-clock" });
  },
}));

const mockCustomDayIndicator = jest.fn();
jest.mock("../../../src/features/clock/components/CustomDayIndicator", () => ({
  CustomDayIndicator: (props: Record<string, unknown>) => {
    mockCustomDayIndicator(props);
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "custom-day-indicator" });
  },
}));

function renderWithProviders(
  overrides?: Partial<AppSettings>,
  store = createStore(),
) {
  store.set(settingsAtom, { ...DEFAULT_SETTINGS, ...overrides });
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <ClockScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("ClockScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAnalogClock.mockClear();
    mockCustomDayIndicator.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should render clock screen", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("clock-screen")).toBeTruthy();
  });

  it("should render digital clock", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("digital-clock")).toBeTruthy();
  });

  it("should render analog clock", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("analog-clock")).toBeTruthy();
  });

  it("should render custom day indicator", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("custom-day-indicator")).toBeTruthy();
  });

  describe("mode integration", () => {
    it("should pass mode='custom' to AnalogClock when primaryTimeDisplay is custom", async () => {
      await renderWithProviders({ primaryTimeDisplay: "custom" });
      expect(mockAnalogClock).toHaveBeenCalled();
      const props = mockAnalogClock.mock.calls[0][0];
      expect(props.mode).toBe("custom");
    });

    it("should pass mode='24h' to AnalogClock when primaryTimeDisplay is 24h", async () => {
      await renderWithProviders({ primaryTimeDisplay: "24h" });
      expect(mockAnalogClock).toHaveBeenCalled();
      const props = mockAnalogClock.mock.calls[0][0];
      expect(props.mode).toBe("24h");
    });

    it("should pass realTimeMs to AnalogClock", async () => {
      await renderWithProviders();
      expect(mockAnalogClock).toHaveBeenCalled();
      const props = mockAnalogClock.mock.calls[0][0];
      expect(typeof props.realTimeMs).toBe("number");
      expect(props.realTimeMs).toBeGreaterThan(0);
    });

    it("should pass realTimeMs to CustomDayIndicator", async () => {
      await renderWithProviders();
      expect(mockCustomDayIndicator).toHaveBeenCalled();
      const props = mockCustomDayIndicator.mock.calls[0][0];
      expect(typeof props.realTimeMs).toBe("number");
      expect(props.realTimeMs).toBeGreaterThan(0);
    });
  });
});
