import { by, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

async function calendarNavigationTitle(): Promise<string> {
  const attributes = await element(
    by.id("calendar-navigation-title"),
  ).getAttributes();
  if ("elements" in attributes || !("text" in attributes)) {
    throw new Error("Calendar navigation title is unavailable");
  }
  return attributes.text ?? "";
}

describe("Calendar Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Calendar");
  });

  it("displays calendar screen", async () => {
    await waitVisible("calendar-screen");
  });

  describe("View Switching", () => {
    it("shows view mode segmented buttons", async () => {
      // SegmentedButtons renders "Month", "Week", "Agenda" labels
      await expect(element(by.text("Month")).atIndex(0)).toBeVisible();
      await expect(element(by.text("Week")).atIndex(0)).toBeVisible();
      await expect(element(by.text("Agenda")).atIndex(0)).toBeVisible();
    });

    it("switches to month view", async () => {
      await element(by.text("Month")).atIndex(0).tap();
      await waitVisible("month-view");
    });

    it("switches to week view", async () => {
      await element(by.text("Week")).atIndex(0).tap();
      await waitVisible("week-view");
    });

    it("switches to agenda view", async () => {
      await element(by.text("Agenda")).atIndex(0).tap();
      await waitVisible("agenda-view");
    });

    it("retains view after switching back and forth", async () => {
      await element(by.text("Month")).atIndex(0).tap();
      await waitVisible("month-view");
      await element(by.text("Week")).atIndex(0).tap();
      await waitVisible("week-view");
      // Month view should no longer be visible
      await waitFor(element(by.id("month-view")))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });

  describe("Navigation Header", () => {
    beforeAll(async () => {
      // Ensure we are in month view for predictable navigation
      await element(by.text("Month")).atIndex(0).tap();
      await waitVisible("month-view");
    });

    it("navigates to previous period via chevron-left", async () => {
      const before = await calendarNavigationTitle();
      await element(by.label("Previous period")).tap();
      const after = await calendarNavigationTitle();
      if (before === after) {
        throw new Error("Previous period did not change the calendar title");
      }
    });

    it("navigates to next period via chevron-right", async () => {
      const before = await calendarNavigationTitle();
      await element(by.label("Next period")).tap();
      const after = await calendarNavigationTitle();
      if (before === after) {
        throw new Error("Next period did not change the calendar title");
      }
    });

    it("returns to today via calendar-today button", async () => {
      // Navigate away from today first
      await element(by.label("Previous period")).tap();
      await element(by.label("Previous period")).tap();
      // Tap the today button (accessibilityLabel "Today")
      await element(by.label("Today")).atIndex(0).tap();
      await expect(element(by.id("calendar-navigation-title"))).toBeVisible();
    });
  });
});
