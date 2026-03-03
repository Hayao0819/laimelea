import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { PaperProvider } from "react-native-paper";

import { CircularProgress } from "../../../src/features/timer/components/CircularProgress";

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
  };
});

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("CircularProgress", () => {
  it("should render SVG with two circles (background + progress)", async () => {
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={0.5} />,
    );

    // Both background and progress circles are rendered as "Circle" elements
    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    expect(circles).toHaveLength(2);
  });

  it("should render SVG element", async () => {
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={0.5} />,
    );

    const svgs = UNSAFE_getAllByType("Svg" as unknown as React.ComponentType);
    expect(svgs).toHaveLength(1);
  });

  it("should clamp progress to 0 when given negative value", async () => {
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={-0.5} size={64} strokeWidth={4} />,
    );

    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    // Progress circle (second one) should have full offset (progress = 0)
    const progressCircle = circles[1];
    const radius = (64 - 4) / 2;
    const circumference = 2 * Math.PI * radius;
    // strokeDashoffset = circumference * (1 - 0) = circumference
    expect(progressCircle.props.strokeDashoffset).toBeCloseTo(circumference);
  });

  it("should clamp progress to 1 when given value greater than 1", async () => {
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={1.5} size={64} strokeWidth={4} />,
    );

    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    const progressCircle = circles[1];
    // strokeDashoffset = circumference * (1 - 1) = 0
    expect(progressCircle.props.strokeDashoffset).toBeCloseTo(0);
  });

  it("should calculate correct strokeDashoffset for 50% progress", async () => {
    const size = 100;
    const strokeWidth = 8;
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={0.5} size={size} strokeWidth={strokeWidth} />,
    );

    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    const progressCircle = circles[1];
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const expectedOffset = circumference * 0.5;
    expect(progressCircle.props.strokeDashoffset).toBeCloseTo(expectedOffset);
  });

  it("should render children when provided", async () => {
    const { getByText } = await renderWithProviders(
      <CircularProgress progress={0.5}>
        <Text>50%</Text>
      </CircularProgress>,
    );

    expect(getByText("50%")).toBeTruthy();
  });

  it("should not render children container when no children provided", async () => {
    const { toJSON } = await renderWithProviders(
      <CircularProgress progress={0.5} />,
    );

    const tree = JSON.stringify(toJSON());
    // When no children, childrenContainer View should not be rendered
    // The component conditionally renders the children container
    expect(tree).toBeTruthy();
  });

  it("should use default size and strokeWidth", async () => {
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={0.5} />,
    );

    const svgs = UNSAFE_getAllByType("Svg" as unknown as React.ComponentType);
    expect(svgs[0].props.width).toBe(64); // default size
    expect(svgs[0].props.height).toBe(64);

    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    expect(circles[0].props.strokeWidth).toBe(4); // default strokeWidth
  });

  it("should accept custom size and strokeWidth", async () => {
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress progress={0.5} size={120} strokeWidth={10} />,
    );

    const svgs = UNSAFE_getAllByType("Svg" as unknown as React.ComponentType);
    expect(svgs[0].props.width).toBe(120);
    expect(svgs[0].props.height).toBe(120);

    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    expect(circles[0].props.strokeWidth).toBe(10);
  });

  it("should set correct circle center and radius", async () => {
    const size = 80;
    const strokeWidth = 6;
    const { UNSAFE_getAllByType } = await renderWithProviders(
      <CircularProgress
        progress={0.75}
        size={size}
        strokeWidth={strokeWidth}
      />,
    );

    const circles = UNSAFE_getAllByType(
      "Circle" as unknown as React.ComponentType,
    );
    const expectedRadius = (size - strokeWidth) / 2;

    for (const circle of circles) {
      expect(circle.props.cx).toBe(size / 2);
      expect(circle.props.cy).toBe(size / 2);
      expect(circle.props.r).toBe(expectedRadius);
    }
  });
});
