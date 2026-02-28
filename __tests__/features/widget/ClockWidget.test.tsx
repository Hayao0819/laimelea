import React from "react";
import { render } from "@testing-library/react-native";
import { ClockWidget } from "../../../src/features/widget/ClockWidget";
import type { CycleConfig } from "../../../src/models/CustomTime";
import type { Alarm } from "../../../src/models/Alarm";

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
      // We test through the rendered realTime TextWidget.
      // Use a known timestamp and verify the output matches local time.
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

      // The real time text should be in the rendered output
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

      // Custom time should be HH:MM format (from formatCustomTimeShort)
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

      // Day text should match "Day N" format
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
      // Should be just the time without trailing space
      expect(alarmTexts[0].text).toMatch(/^\u23F0 \d{2}:\d{2}$/);
    });

    it("should render exactly 3 TextWidgets when no alarm, 4 when alarm exists", async () => {
      // Without alarm: customTime, day, realTime
      const { toJSON: noAlarmTree } = await render(
        <ClockWidget
          cycleConfig={baseCycleConfig}
          alarms={[]}
          nowMs={fixedNowMs}
        />,
      );
      expect(collectTextWidgets(noAlarmTree())).toHaveLength(3);

      // With alarm: customTime, day, realTime, alarm
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
});
