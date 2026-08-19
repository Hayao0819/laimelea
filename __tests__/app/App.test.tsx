import { render } from "@testing-library/react-native";
import React from "react";
import { ActivityIndicator } from "react-native";

let mockSuspendRoot = false;

jest.mock("../../src/app/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => {
    const ReactLib = require("react");
    const { View: NativeView } = require("react-native");
    return ReactLib.createElement(
      NativeView,
      { testID: "providers" },
      children,
    );
  },
}));

jest.mock("../../src/navigation/RootNavigator", () => ({
  RootNavigator: () => {
    if (mockSuspendRoot) throw new Promise(() => {});
    const ReactLib = require("react");
    const { Text: NativeText } = require("react-native");
    return ReactLib.createElement(NativeText, null, "Root navigator");
  },
}));

import App from "../../src/app/App";

describe("App", () => {
  beforeEach(() => {
    mockSuspendRoot = false;
  });

  it("renders the provider tree and root navigator", () => {
    const { getByTestId, getByText } = render(<App />);

    expect(getByTestId("providers")).toBeTruthy();
    expect(getByText("Root navigator")).toBeTruthy();
  });

  it("shows a loading indicator while the navigator is suspended", () => {
    mockSuspendRoot = true;
    const { UNSAFE_getByType } = render(<App />);

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});
