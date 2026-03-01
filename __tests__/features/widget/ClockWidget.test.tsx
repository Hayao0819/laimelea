import React from "react";
import { render } from "@testing-library/react-native";
import { ClockWidget } from "../../../src/features/widget/ClockWidget";
import type { CycleConfig } from "../../../src/models/CustomTime";
import type { Alarm } from "../../../src/models/Alarm";
import type { WidgetSettings } from "../../../src/models/Settings";
import { DEFAULT_WIDGET_SETTINGS } from "../../../src/models/Settings";

jest.mock("react-native-android-widget", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require("react");
  return {
    FlexWidget: ({ children, ...props }: any) =>
      React.createElement("FlexWidget", props, children),
    TextWidget: ({ text, ...props }: any) =>
      React.createElement("TextWidget", { ...props, children: text }),
  };
});

const baseCycleConfig: CycleConfig = {
  cycleLengthMinutes: 1560, // 26h
  baseTimeMs: 0,
};

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "",
    enabled: true,
    targetTimestampMs: Date.now() + 3600_000,
    setInTimeSystem: "custom",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 10,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

type TreeNode = ReturnType<ReturnType<typeof render>["toJSON"]>;

function collectTextWidgets(
  tree: TreeNode,
): { text: string; props: Record<string, unknown> }[] {
  const results: { text: string; props: Record<string, unknown> }[] = [];
  function walk(node: TreeNode): void {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === "TextWidget" && node.children) {
      for (const child of node.children) {
        if (typeof child === "string") {
          results.push({
            text: child,
            props: (node.props ?? {}) as Record<string, unknown>,
          });
        }
      }
    }
    if (node.children) {
      node.children.forEach((c: unknown) => walk(c as TreeNode));
    }
  }
  walk(tree);
  return results;
}

function getFlexWidgetProps(tree: TreeNode): Record<string, unknown> {
  if (!tree || typeof tree === "string" || Array.isArray(tree)) return {};
  if (tree.type === "FlexWidget") {
    return (tree.props ?? {}) as Record<string, unknown>;
  }
  return {};
}

describe("ClockWidget", () => {
  // Use a fixed "now" to avoid timezone-dependent flakiness in formatRealTime tests.
  // 2026-03-01T10:05:00Z = 1740823500000
  const fixedNowMs = 1740823500000;

  describe("getNextAlarm (indirect)", () => {
    it("should return the earliest enabled future alarm", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "Later",
          enabled: true,
          targetTimestampMs: fixedNowMs + 7200_000,
        }),
        makeAlarm({
          id: "a2",
          label: "Sooner",
          enabled: true,
          targetTimestampMs: fixedNowMs + 3600_000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(1);
      expect(alarmTexts[0].text).toContain("Sooner");
    });

    it("should skip disabled alarms", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "Disabled",
          enabled: false,
          targetTimestampMs: fixedNowMs + 1000,
        }),
        makeAlarm({
          id: "a2",
          label: "Enabled",
          enabled: true,
          targetTimestampMs: fixedNowMs + 5000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(1);
      expect(alarmTexts[0].text).toContain("Enabled");
      expect(alarmTexts[0].text).not.toContain("Disabled");
    });

    it("should skip past alarms", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "Past",
          enabled: true,
          targetTimestampMs: fixedNowMs - 1000,
        }),
        makeAlarm({
          id: "a2",
          label: "Future",
          enabled: true,
          targetTimestampMs: fixedNowMs + 5000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(1);
      expect(alarmTexts[0].text).toContain("Future");
      expect(alarmTexts[0].text).not.toContain("Past");
    });

    it("should return undefined when no alarms match", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          enabled: false,
          targetTimestampMs: fixedNowMs + 1000,
        }),
        makeAlarm({
          id: "a2",
          enabled: true,
          targetTimestampMs: fixedNowMs - 1000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(0);
    });
  });

  describe("formatRealTime (indirect)", () => {
    it("should format timestamp as HH:MM with zero padding", async () => {
      const date = new Date(fixedNowMs);
      const expectedHours = String(date.getHours()).padStart(2, "0");
      const expectedMinutes = String(date.getMinutes()).padStart(2, "0");
      const expected = `${expectedHours}:${expectedMinutes}`;

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());

      const realTimeTexts = texts.filter((t) => t.text === expected);
      expect(realTimeTexts).toHaveLength(1);
    });
  });

  describe("rendering", () => {
    it("should render custom time text", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());

      const customTimeTexts = texts.filter((t) => /^\d{2}:\d{2}$/.test(t.text));
      expect(customTimeTexts.length).toBeGreaterThanOrEqual(1);
    });

    it("should render day text", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());

      const dayTexts = texts.filter((t) => /^Day -?\d+$/.test(t.text));
      expect(dayTexts).toHaveLength(1);
    });

    it("should render real time text", async () => {
      const date = new Date(fixedNowMs);
      const expectedHours = String(date.getHours()).padStart(2, "0");
      const expectedMinutes = String(date.getMinutes()).padStart(2, "0");
      const expected = `${expectedHours}:${expectedMinutes}`;

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());

      expect(texts.some((t) => t.text === expected)).toBe(true);
    });

    it("should render next alarm when one exists", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "Wake Up",
          enabled: true,
          targetTimestampMs: fixedNowMs + 3600_000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(1);
      expect(alarmTexts[0].text).toContain("Wake Up");
    });

    it("should not render alarm text when no future alarms", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(0);
    });

    it("should render alarm without label correctly", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "",
          enabled: true,
          targetTimestampMs: fixedNowMs + 3600_000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(1);
      expect(alarmTexts[0].text).toMatch(/^\u23F0 \d{2}:\d{2}$/);
    });

    it("should render exactly 3 TextWidgets when no alarm, 4 when alarm exists", async () => {
      const { toJSON: noAlarmTree } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      expect(collectTextWidgets(noAlarmTree())).toHaveLength(3);

      const alarms = [
        makeAlarm({
          id: "a1",
          enabled: true,
          targetTimestampMs: fixedNowMs + 1000,
        }),
      ];
      const { toJSON: withAlarmTree } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      expect(collectTextWidgets(withAlarmTree())).toHaveLength(4);
    });
  });

  describe("widgetSettings", () => {
    const customSettings: WidgetSettings = {
      backgroundColor: "#FF0000",
      textColor: "#00FF00",
      secondaryTextColor: "#0000FF",
      accentColor: "#FFFF00",
      opacity: 80,
      borderRadius: 24,
      showRealTime: true,
      showNextAlarm: true,
    };

    it("should apply backgroundColor with opacity to container", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={customSettings}
        />,
      );
      const props = getFlexWidgetProps(toJSON());
      const style = props.style as Record<string, unknown>;

      // opacity 80 => alpha = Math.round((80/100)*255) = 204 = 0xCC
      expect(style.backgroundColor).toBe("#FF0000CC");
    });

    it("should apply borderRadius from widgetSettings", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={customSettings}
        />,
      );
      const props = getFlexWidgetProps(toJSON());
      const style = props.style as Record<string, unknown>;

      expect(style.borderRadius).toBe(24);
    });

    it("should apply textColor to custom time", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={customSettings}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const customTimeTexts = texts.filter((t) => /^\d{2}:\d{2}$/.test(t.text));

      expect(customTimeTexts.length).toBeGreaterThanOrEqual(1);
      const style = customTimeTexts[0].props.style as Record<string, unknown>;
      expect(style.color).toBe("#00FF00");
    });

    it("should apply secondaryTextColor to day and realTime", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={customSettings}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const dayTexts = texts.filter((t) => /^Day -?\d+$/.test(t.text));
      const date = new Date(fixedNowMs);
      const expectedTime = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      const realTimeTexts = texts.filter((t) => t.text === expectedTime);

      expect(dayTexts).toHaveLength(1);
      expect((dayTexts[0].props.style as Record<string, unknown>).color).toBe(
        "#0000FF",
      );
      expect(realTimeTexts).toHaveLength(1);
      expect(
        (realTimeTexts[0].props.style as Record<string, unknown>).color,
      ).toBe("#0000FF");
    });

    it("should apply accentColor to alarm text", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "Test",
          enabled: true,
          targetTimestampMs: fixedNowMs + 3600_000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
          widgetSettings={customSettings}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(1);
      expect((alarmTexts[0].props.style as Record<string, unknown>).color).toBe(
        "#FFFF00",
      );
    });

    it("should use DEFAULT_WIDGET_SETTINGS when widgetSettings not provided", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      const props = getFlexWidgetProps(toJSON());
      const style = props.style as Record<string, unknown>;

      // DEFAULT opacity is 100 => alpha = 255 = 0xFF
      expect(style.backgroundColor).toBe(
        `${DEFAULT_WIDGET_SETTINGS.backgroundColor}FF`,
      );
      expect(style.borderRadius).toBe(DEFAULT_WIDGET_SETTINGS.borderRadius);
    });

    it("should hide realTime when showRealTime is false", async () => {
      const date = new Date(fixedNowMs);
      const expectedTime = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={{ ...customSettings, showRealTime: false }}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const realTimeTexts = texts.filter((t) => t.text === expectedTime);

      expect(realTimeTexts).toHaveLength(0);
    });

    it("should hide alarm when showNextAlarm is false", async () => {
      const alarms = [
        makeAlarm({
          id: "a1",
          label: "Hidden",
          enabled: true,
          targetTimestampMs: fixedNowMs + 3600_000,
        }),
      ];

      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
          widgetSettings={{ ...customSettings, showNextAlarm: false }}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const alarmTexts = texts.filter((t) => t.text.startsWith("\u23F0"));

      expect(alarmTexts).toHaveLength(0);
    });

    it("should clamp opacity to 0-100 range", async () => {
      // Opacity > 100 should be clamped to 100 (0xFF)
      const { toJSON: overTree } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={{ ...customSettings, opacity: 150 }}
        />,
      );
      const overProps = getFlexWidgetProps(overTree());
      const overStyle = overProps.style as Record<string, unknown>;
      expect(overStyle.backgroundColor).toBe("#FF0000FF");

      // Opacity < 0 should be clamped to 0 (0x00)
      const { toJSON: underTree } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSettings={{ ...customSettings, opacity: -10 }}
        />,
      );
      const underProps = getFlexWidgetProps(underTree());
      const underStyle = underProps.style as Record<string, unknown>;
      expect(underStyle.backgroundColor).toBe("#FF000000");
    });
  });

  describe("widgetSize", () => {
    const alarms = [
      makeAlarm({
        id: "a1",
        label: "Test",
        enabled: true,
        targetTimestampMs: fixedNowMs + 3600_000,
      }),
    ];

    it("should show only customTime for small size", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
          widgetSize="small"
        />,
      );
      const texts = collectTextWidgets(toJSON());

      // Small: only customTime (no day, realTime, or alarm)
      expect(texts).toHaveLength(1);
      expect(texts[0].text).toMatch(/^\d{2}:\d{2}$/);
    });

    it("should use small font size and padding for small size", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSize="small"
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const containerProps = getFlexWidgetProps(toJSON());
      const containerStyle = containerProps.style as Record<string, unknown>;

      expect(containerStyle.padding).toBe(8);
      expect((texts[0].props.style as Record<string, unknown>).fontSize).toBe(
        28,
      );
    });

    it("should render all elements for medium size", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
          widgetSize="medium"
        />,
      );
      const texts = collectTextWidgets(toJSON());

      // Medium: customTime + day + realTime + alarm = 4
      expect(texts).toHaveLength(4);
    });

    it("should use medium font sizes for medium size", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
          widgetSize="medium"
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const containerProps = getFlexWidgetProps(toJSON());
      const containerStyle = containerProps.style as Record<string, unknown>;

      expect(containerStyle.padding).toBe(12);
      // customTime fontSize = 36
      expect((texts[0].props.style as Record<string, unknown>).fontSize).toBe(
        36,
      );
    });

    it("should use large font sizes and padding for large size", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
          widgetSize="large"
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const containerProps = getFlexWidgetProps(toJSON());
      const containerStyle = containerProps.style as Record<string, unknown>;

      expect(containerStyle.padding).toBe(20);
      // customTime fontSize = 48
      expect((texts[0].props.style as Record<string, unknown>).fontSize).toBe(
        48,
      );
      // day fontSize = 18
      expect((texts[1].props.style as Record<string, unknown>).fontSize).toBe(
        18,
      );
    });

    it("should default to medium size when widgetSize is not provided", async () => {
      const { toJSON } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={alarms}
          nowMs={fixedNowMs}
        />,
      );
      const texts = collectTextWidgets(toJSON());
      const containerProps = getFlexWidgetProps(toJSON());
      const containerStyle = containerProps.style as Record<string, unknown>;

      expect(containerStyle.padding).toBe(12);
      expect(texts).toHaveLength(4);
    });
  });
});
