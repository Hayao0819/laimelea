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
    Path: createMockComponent("Path"),
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

const sampleRealTimeMs = new Date(2026, 1, 28, 10, 30, 15).getTime();

function renderWithPaper(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

type TreeNode = ReturnType<ReturnType<typeof render>["toJSON"]>;

function countNodesByType(tree: TreeNode, type: string): number {
  let count = 0;
  function walk(node: TreeNode): void {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === type) count++;
    if (node.children)
      node.children.forEach((c: unknown) => walk(c as TreeNode));
  }
  walk(tree);
  return count;
}

function collectLabels(
  tree: TreeNode,
): { text: string; fontSize: unknown; fontWeight: unknown }[] {
  const labels: { text: string; fontSize: unknown; fontWeight: unknown }[] = [];
  function walk(node: TreeNode): void {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === "SvgText" && node.children) {
      for (const child of node.children) {
        if (typeof child === "string") {
          labels.push({
            text: child,
            fontSize: node.props?.fontSize,
            fontWeight: node.props?.fontWeight,
          });
        }
      }
    }
    if (node.children)
      node.children.forEach((c: unknown) => walk(c as TreeNode));
  }
  walk(tree);
  return labels;
}

describe("AnalogClock", () => {
  describe("custom mode", () => {
    it('should render with testID "analog-clock"', async () => {
      const { getByTestId } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      expect(getByTestId("analog-clock")).toBeTruthy();
    });

    it("should render SVG with correct markers for 26h cycle (13 markers)", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      expect(countNodesByType(toJSON(), "G")).toBe(13);
    });

    it("should render tapered hour and minute hands as Path elements", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const tree = toJSON();

      const paths: Record<string, unknown>[] = [];
      function collectPaths(node: TreeNode): void {
        if (!node || typeof node === "string") return;
        if (Array.isArray(node)) {
          node.forEach(collectPaths);
          return;
        }
        if (node.type === "Path" && node.props?.d) {
          paths.push(node.props as Record<string, unknown>);
        }
        if (node.children)
          node.children.forEach((c: unknown) => collectPaths(c as TreeNode));
      }
      collectPaths(tree);

      // Hour hand + Minute hand = 2 Path elements
      expect(paths).toHaveLength(2);
    });

    it("should render second hand as a thin Line", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const tree = toJSON();

      let hasSecondHand = false;
      function findSecondHand(node: TreeNode): void {
        if (!node || typeof node === "string") return;
        if (Array.isArray(node)) {
          node.forEach(findSecondHand);
          return;
        }
        if (
          node.type === "Line" &&
          node.props?.strokeWidth === 1 &&
          node.props?.strokeLinecap === "round"
        ) {
          hasSecondHand = true;
        }
        if (node.children)
          node.children.forEach((c: unknown) => findSecondHand(c as TreeNode));
      }
      findSecondHand(tree);

      expect(hasSecondHand).toBe(true);
    });

    it("should handle 24h cycle (12 markers)", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1440}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      expect(countNodesByType(toJSON(), "G")).toBe(12);
    });

    it("should handle 28h cycle (14 markers)", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1680}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      expect(countNodesByType(toJSON(), "G")).toBe(14);
    });

    it("should render with custom size", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
          size={400}
        />,
      );
      const tree = toJSON();

      function findSvg(node: TreeNode): Record<string, unknown> | null {
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
            const result = findSvg(child as TreeNode);
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

    it("should display all hour labels with cardinal emphasis for 26h cycle", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const labels = collectLabels(toJSON());

      // All 13 markers should have labels
      expect(labels).toHaveLength(13);
      // Cardinal labels (0, 3, 7, 10) should be larger
      const cardinals = labels.filter((l) =>
        ["0", "3", "7", "10"].includes(l.text),
      );
      expect(cardinals).toHaveLength(4);
      for (const c of cardinals) {
        expect(c.fontSize).toBe(14);
        expect(c.fontWeight).toBe("500");
      }
      // Non-cardinal labels should be smaller
      const minors = labels.filter(
        (l) => !["0", "3", "7", "10"].includes(l.text),
      );
      expect(minors).toHaveLength(9);
      for (const m of minors) {
        expect(m.fontSize).toBe(10);
      }
    });

    it("should render second hand counterweight", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const tree = toJSON();

      let hasTailLine = false;
      let hasTailDot = false;
      function findCounterweight(node: TreeNode): void {
        if (!node || typeof node === "string") return;
        if (Array.isArray(node)) {
          node.forEach(findCounterweight);
          return;
        }
        if (node.type === "Line" && node.props?.strokeWidth === 2.5)
          hasTailLine = true;
        if (node.type === "Circle" && node.props?.r === 3.5) hasTailDot = true;
        if (node.children)
          node.children.forEach((c: unknown) =>
            findCounterweight(c as TreeNode),
          );
      }
      findCounterweight(tree);

      expect(hasTailLine).toBe(true);
      expect(hasTailDot).toBe(true);
    });

    it("should render non-cardinal labels with reduced opacity", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="custom"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const tree = toJSON();

      const minorLabels: { opacity: unknown }[] = [];
      function collectMinorLabels(node: TreeNode): void {
        if (!node || typeof node === "string") return;
        if (Array.isArray(node)) {
          node.forEach(collectMinorLabels);
          return;
        }
        if (
          node.type === "SvgText" &&
          node.props?.fontSize === 10 &&
          node.props?.opacity !== undefined
        ) {
          minorLabels.push({ opacity: node.props.opacity });
        }
        if (node.children)
          node.children.forEach((c: unknown) =>
            collectMinorLabels(c as TreeNode),
          );
      }
      collectMinorLabels(tree);

      // 9 non-cardinal labels should have reduced opacity
      expect(minorLabels).toHaveLength(9);
      for (const label of minorLabels) {
        expect(label.opacity).toBe(0.6);
      }
    });
  });

  describe("24h mode", () => {
    it("should render 12 markers in 24h mode", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="24h"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      expect(countNodesByType(toJSON(), "G")).toBe(12);
    });

    it("should have cardinal labels at 0, 3, 6, 9 in 24h mode", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="24h"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const labels = collectLabels(toJSON());

      expect(labels).toHaveLength(12);

      const cardinals = labels.filter((l) =>
        ["0", "3", "6", "9"].includes(l.text),
      );
      expect(cardinals).toHaveLength(4);
      for (const c of cardinals) {
        expect(c.fontSize).toBe(14);
        expect(c.fontWeight).toBe("500");
      }

      const minors = labels.filter(
        (l) => !["0", "3", "6", "9"].includes(l.text),
      );
      expect(minors).toHaveLength(8);
      for (const m of minors) {
        expect(m.fontSize).toBe(10);
      }
    });

    it("should always render 12 markers regardless of cycleLengthMinutes in 24h mode", async () => {
      // Even with a 28h cycle config, 24h mode should still show 12 markers
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1680}
          mode="24h"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      expect(countNodesByType(toJSON(), "G")).toBe(12);
    });

    it("should render hour and minute hands based on realTimeMs", async () => {
      const { toJSON } = await renderWithPaper(
        <AnalogClock
          customTime={sampleCustomTime}
          cycleLengthMinutes={1560}
          mode="24h"
          realTimeMs={sampleRealTimeMs}
        />,
      );
      const tree = toJSON();

      // Verify the clock renders Path elements for hands
      const paths: string[] = [];
      function collectPaths(node: TreeNode): void {
        if (!node || typeof node === "string") return;
        if (Array.isArray(node)) {
          node.forEach(collectPaths);
          return;
        }
        if (node.type === "Path" && node.props?.d) {
          paths.push(node.props.d as string);
        }
        if (node.children)
          node.children.forEach((c: unknown) => collectPaths(c as TreeNode));
      }
      collectPaths(tree);

      expect(paths).toHaveLength(2);
    });
  });
});
