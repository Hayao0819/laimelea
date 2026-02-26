import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { AnalogClock } from "../../../src/features/clock/components/AnalogClock";
import type { CustomTimeValue } from "../../../src/models/CustomTime";

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
    G: createMockComponent("G"),
    Text: createMockComponent("SvgText"),
  };
});

const sampleCustomTime: CustomTimeValue = {
  day: 1,
  hours: 10,
  minutes: 30,
  seconds: 15,
};

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe("AnalogClock", () => {
  it('should render with testID "analog-clock"', async () => {
    const { getByTestId } = await renderWithPaper(
      <AnalogClock customTime={sampleCustomTime} cycleLengthMinutes={1560} />,
    );
    expect(getByTestId("analog-clock")).toBeTruthy();
  });

  it("should render SVG with correct markers for 26h cycle (13 markers)", async () => {
    // 26h cycle = 1560 minutes. hoursPerRevolution = 26/2 = 13. count = ceil(13) = 13
    const { toJSON } = await renderWithPaper(
      <AnalogClock customTime={sampleCustomTime} cycleLengthMinutes={1560} />,
    );
    const tree = toJSON();

    // Count G elements in the tree (each marker generates one G)
    let gCount = 0;
    function countGs(node: ReturnType<typeof toJSON>): void {
      if (!node || typeof node === "string") return;
      if (Array.isArray(node)) {
        node.forEach(countGs);
        return;
      }
      if (node.type === "G") gCount++;
      if (node.children) node.children.forEach((c) => countGs(c as ReturnType<typeof toJSON>));
    }
    countGs(tree);

    expect(gCount).toBe(13);
  });

  it("should render hour, minute, and second hands", async () => {
    const { toJSON } = await renderWithPaper(
      <AnalogClock customTime={sampleCustomTime} cycleLengthMinutes={1560} />,
    );
    const tree = toJSON();

    // Collect all Line elements with their strokeWidth props
    const lineStrokeWidths: number[] = [];
    function collectLines(node: ReturnType<typeof toJSON>): void {
      if (!node || typeof node === "string") return;
      if (Array.isArray(node)) {
        node.forEach(collectLines);
        return;
      }
      if (node.type === "Line" && node.props?.strokeLinecap === "round") {
        lineStrokeWidths.push(Number(node.props.strokeWidth));
      }
      if (node.children) node.children.forEach((c) => collectLines(c as ReturnType<typeof toJSON>));
    }
    collectLines(tree);

    // Hour hand: strokeWidth 4, Minute hand: strokeWidth 3, Second hand: strokeWidth 1.5
    expect(lineStrokeWidths).toContain(4);
    expect(lineStrokeWidths).toContain(3);
    expect(lineStrokeWidths).toContain(1.5);
  });

  it("should handle 24h cycle (12 markers)", async () => {
    // 24h cycle = 1440 minutes. hoursPerRevolution = 24/2 = 12. count = ceil(12) = 12
    const { toJSON } = await renderWithPaper(
      <AnalogClock customTime={sampleCustomTime} cycleLengthMinutes={1440} />,
    );
    const tree = toJSON();

    let gCount = 0;
    function countGs(node: ReturnType<typeof toJSON>): void {
      if (!node || typeof node === "string") return;
      if (Array.isArray(node)) {
        node.forEach(countGs);
        return;
      }
      if (node.type === "G") gCount++;
      if (node.children) node.children.forEach((c) => countGs(c as ReturnType<typeof toJSON>));
    }
    countGs(tree);

    expect(gCount).toBe(12);
  });

  it("should handle 28h cycle (14 markers)", async () => {
    // 28h cycle = 1680 minutes. hoursPerRevolution = 28/2 = 14. count = ceil(14) = 14
    const { toJSON } = await renderWithPaper(
      <AnalogClock customTime={sampleCustomTime} cycleLengthMinutes={1680} />,
    );
    const tree = toJSON();

    let gCount = 0;
    function countGs(node: ReturnType<typeof toJSON>): void {
      if (!node || typeof node === "string") return;
      if (Array.isArray(node)) {
        node.forEach(countGs);
        return;
      }
      if (node.type === "G") gCount++;
      if (node.children) node.children.forEach((c) => countGs(c as ReturnType<typeof toJSON>));
    }
    countGs(tree);

    expect(gCount).toBe(14);
  });

  it("should render with custom size", async () => {
    const { toJSON } = await renderWithPaper(
      <AnalogClock
        customTime={sampleCustomTime}
        cycleLengthMinutes={1560}
        size={400}
      />,
    );
    const tree = toJSON();

    // Find the Svg element and check its width/height
    function findSvg(node: ReturnType<typeof toJSON>): Record<string, unknown> | null {
      if (!node || typeof node === "string") return null;
      if (Array.isArray(node)) {
        for (const n of node) {
          const result = findSvg(n);
          if (result) return result;
        }
        return null;
      }
      if (node.type === "Svg") return node.props as Record<string, unknown>;
      if (node.children) {
        for (const child of node.children) {
          const result = findSvg(child as ReturnType<typeof toJSON>);
          if (result) return result;
        }
      }
      return null;
    }

    const svgProps = findSvg(tree);
    expect(svgProps).not.toBeNull();
    expect(svgProps?.width).toBe(400);
    expect(svgProps?.height).toBe(400);
  });

  it("should display even-numbered hour labels", async () => {
    const { toJSON } = await renderWithPaper(
      <AnalogClock customTime={sampleCustomTime} cycleLengthMinutes={1560} />,
    );
    const tree = toJSON();

    // Collect SvgText children (labels for even markers: 0, 2, 4, 6, 8, 10, 12)
    const labels: string[] = [];
    function collectLabels(node: ReturnType<typeof toJSON>): void {
      if (!node || typeof node === "string") return;
      if (Array.isArray(node)) {
        node.forEach(collectLabels);
        return;
      }
      if (node.type === "SvgText" && node.children) {
        for (const child of node.children) {
          if (typeof child === "string") labels.push(child);
        }
      }
      if (node.children) node.children.forEach((c) => collectLabels(c as ReturnType<typeof toJSON>));
    }
    collectLabels(tree);

    // Even markers for 13-marker clock: 0, 2, 4, 6, 8, 10, 12
    expect(labels).toContain("0");
    expect(labels).toContain("2");
    expect(labels).toContain("4");
    expect(labels).toContain("6");
    expect(labels).toContain("8");
    expect(labels).toContain("10");
    expect(labels).toContain("12");
    // Odd markers should NOT have labels
    expect(labels).not.toContain("1");
    expect(labels).not.toContain("3");
  });
});
