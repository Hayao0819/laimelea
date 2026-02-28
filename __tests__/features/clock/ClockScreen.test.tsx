import React from "react";
import { render } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { ClockScreen } from "../../../src/features/clock/screens/ClockScreen";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

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

function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
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
});
