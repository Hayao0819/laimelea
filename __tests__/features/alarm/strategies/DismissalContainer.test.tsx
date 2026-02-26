import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { DismissalContainer } from "../../../../src/features/alarm/components/dismissal/DismissalContainer";
import {
  registerStrategy,
  clearStrategies,
} from "../../../../src/features/alarm/strategies/registry";
import type { DismissalStrategy } from "../../../../src/features/alarm/strategies/types";

jest.mock("react-native-shake", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

// Register test strategies
const MockSimple = (_props: { onDismiss: () => void }) => {
  const { View, Text } = require("react-native");
  return (
    <View testID="mock-simple">
      <Text>Simple</Text>
    </View>
  );
};

const MockShake = () => {
  const { View, Text } = require("react-native");
  return (
    <View testID="mock-shake">
      <Text>Shake</Text>
    </View>
  );
};

const simpleStrategy: DismissalStrategy = {
  id: "simple",
  displayName: "dismissal.simple",
  description: "dismissal.simpleDesc",
  icon: "gesture-tap",
  Component: MockSimple as unknown as DismissalStrategy["Component"],
};

const shakeStrategy: DismissalStrategy = {
  id: "shake",
  displayName: "dismissal.shake",
  description: "dismissal.shakeDesc",
  icon: "cellphone-wireless",
  Component: MockShake as unknown as DismissalStrategy["Component"],
};

function renderContainer(method: string) {
  return render(
    <PaperProvider>
      <DismissalContainer
        method={method as "simple" | "shake" | "math"}
        difficulty={1}
        onDismiss={jest.fn()}
        onSnooze={jest.fn()}
        canSnooze={true}
      />
    </PaperProvider>,
  );
}

describe("DismissalContainer", () => {
  beforeEach(() => {
    clearStrategies();
    registerStrategy(simpleStrategy);
    registerStrategy(shakeStrategy);
  });

  it("should render the correct strategy component for simple", async () => {
    const { getByTestId } = await renderContainer("simple");
    expect(getByTestId("mock-simple")).toBeTruthy();
  });

  it("should render the correct strategy component for shake", async () => {
    const { getByTestId } = await renderContainer("shake");
    expect(getByTestId("mock-shake")).toBeTruthy();
  });

  it("should fallback to simple for unknown method", async () => {
    const { getByTestId } = await renderContainer("unknown");
    expect(getByTestId("mock-simple")).toBeTruthy();
  });

  it("should render nothing when no strategies registered", async () => {
    clearStrategies();
    const { queryByTestId } = await renderContainer("simple");
    expect(queryByTestId("mock-simple")).toBeNull();
    expect(queryByTestId("mock-shake")).toBeNull();
  });

  it("should not render shake component for simple method", async () => {
    const { queryByTestId } = await renderContainer("simple");
    expect(queryByTestId("mock-shake")).toBeNull();
  });
});
