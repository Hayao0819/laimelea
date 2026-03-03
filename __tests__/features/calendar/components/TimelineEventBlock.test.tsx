import { fireEvent,render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { TimelineEventBlock } from "../../../../src/features/calendar/components/TimelineEventBlock";
import type { CalendarEvent } from "../../../../src/models/CalendarEvent";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    sourceEventId: "src-1",
    source: "local",
    title: "Team Meeting",
    description: "Weekly standup",
    startTimestampMs: new Date("2026-03-01T10:00:00").getTime(),
    endTimestampMs: new Date("2026-03-01T11:00:00").getTime(),
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

function renderBlock(
  props: Partial<React.ComponentProps<typeof TimelineEventBlock>> = {},
) {
  const event = props.event ?? makeEvent();
  const utils = render(
    <PaperProvider>
      <TimelineEventBlock
        event={event}
        topOffset={100}
        height={60}
        color="#4285F4"
        {...props}
      />
    </PaperProvider>,
  );
  return { ...utils, event };
}

describe("TimelineEventBlock", () => {
  it("renders event title", async () => {
    const { getByText } = await renderBlock();
    expect(getByText("Team Meeting")).toBeTruthy();
  });

  it("renders time range when height is sufficient (>= 36)", async () => {
    const event = makeEvent({
      startTimestampMs: new Date("2026-03-01T10:00:00").getTime(),
      endTimestampMs: new Date("2026-03-01T11:00:00").getTime(),
    });
    const { getByText } = await renderBlock({ event, height: 60 });

    const startHour = String(
      new Date("2026-03-01T10:00:00").getHours(),
    ).padStart(2, "0");
    const endHour = String(new Date("2026-03-01T11:00:00").getHours()).padStart(
      2,
      "0",
    );
    expect(getByText(`${startHour}:00 - ${endHour}:00`)).toBeTruthy();
  });

  it("hides time range when height is too small (< 36)", async () => {
    const event = makeEvent({
      startTimestampMs: new Date("2026-03-01T10:00:00").getTime(),
      endTimestampMs: new Date("2026-03-01T11:00:00").getTime(),
    });
    const { queryByText } = await renderBlock({ event, height: 30 });

    const startHour = String(
      new Date("2026-03-01T10:00:00").getHours(),
    ).padStart(2, "0");
    const endHour = String(new Date("2026-03-01T11:00:00").getHours()).padStart(
      2,
      "0",
    );
    expect(queryByText(`${startHour}:00 - ${endHour}:00`)).toBeNull();
  });

  it("applies left border with event color", async () => {
    const { toJSON } = await renderBlock({ color: "#FF5733" });
    const tree = toJSON();

    function findBorderColor(
      node: ReturnType<typeof toJSON>,
      color: string,
    ): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node))
        return node.some((n) => findBorderColor(n, color));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      // Merge all style objects to check combined properties
      const merged: Record<string, unknown> = {};
      for (const s of styles) {
        if (s && typeof s === "object") Object.assign(merged, s);
      }
      if (merged.borderLeftColor === color && merged.borderLeftWidth === 4) {
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findBorderColor(child as ReturnType<typeof toJSON>, color))
            return true;
        }
      }
      return false;
    }

    expect(findBorderColor(tree, "#FF5733")).toBe(true);
  });

  it("applies translucent background color", async () => {
    const { toJSON } = await renderBlock({ color: "#4285F4" });
    const tree = toJSON();

    // BG_OPACITY = 0.15 -> Math.round(0.15 * 255) = 38 -> hex "26"
    const expectedBg = "#4285F426";

    function findBgColor(node: ReturnType<typeof toJSON>, bg: string): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findBgColor(n, bg));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (
          s &&
          typeof s === "object" &&
          typeof s.backgroundColor === "string" &&
          s.backgroundColor === bg
        ) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findBgColor(child as ReturnType<typeof toJSON>, bg)) return true;
        }
      }
      return false;
    }

    expect(findBgColor(tree, expectedBg)).toBe(true);
  });

  it("enforces minimum height of 20px", async () => {
    const { toJSON } = await renderBlock({ height: 5 });
    const tree = toJSON();

    function findMinHeight(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findMinHeight(n));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (s && typeof s === "object" && s.height === 20) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findMinHeight(child as ReturnType<typeof toJSON>)) return true;
        }
      }
      return false;
    }

    expect(findMinHeight(tree)).toBe(true);
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const event = makeEvent();
    const { getByTestId } = await renderBlock({ event, onPress });

    await fireEvent.press(getByTestId("timeline-event-event-1"));
    expect(onPress).toHaveBeenCalledWith(event);
  });

  it("uses correct positioning (leftOffset, widthRatio)", async () => {
    const { toJSON } = await renderBlock({
      leftOffset: 0.5,
      widthRatio: 0.5,
    });
    const tree = toJSON();

    function findPositioning(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findPositioning(n));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (
          s &&
          typeof s === "object" &&
          s.left === "50%" &&
          s.width === "50%"
        ) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findPositioning(child as ReturnType<typeof toJSON>)) return true;
        }
      }
      return false;
    }

    expect(findPositioning(tree)).toBe(true);
  });

  it("renders as non-pressable when onPress is not provided", async () => {
    const { getByTestId, toJSON } = await renderBlock({ onPress: undefined });
    const block = getByTestId("timeline-event-event-1");

    // When onPress is not provided, the component renders a View, not a Pressable.
    // View has type "View" in test output.
    expect(block.type).toBe("View");

    // Also verify no accessibilityRole="button" on root block
    const tree = toJSON();
    function findButtonRole(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findButtonRole(n));
      if (
        node.props?.testID === "timeline-event-event-1" &&
        node.props?.accessibilityRole === "button"
      ) {
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findButtonRole(child as ReturnType<typeof toJSON>)) return true;
        }
      }
      return false;
    }

    expect(findButtonRole(tree)).toBe(false);
  });
});
