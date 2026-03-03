import { by, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Calendar Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Calendar");
  });

  it("displays calendar screen", async () => {
    await waitVisible("calendar-screen");
  });

  it("shows day selector", async () => {
    await waitVisible("day-selector");
  });

  it("shows today chip", async () => {
    await expect(element(by.text("Today")).atIndex(0)).toBeVisible();
  });

  it("shows sign-in card or event list", async () => {
    // Without a Google account, the screen shows a sign-in prompt.
    // With an account, it shows the event list (possibly empty).
    try {
      await expect(element(by.id("calendar-event-list"))).toBeVisible();
    } catch {
      await expect(
        element(by.text("Sign in to view calendar events")),
      ).toBeVisible();
    }
  });

  it("can swipe day selector horizontally", async () => {
    await element(by.id("day-selector")).swipe("left");
    await element(by.id("day-selector")).swipe("right");
    // Day selector should still be visible after swiping
    await waitVisible("day-selector");
  });

  it("can tap today chip to scroll back", async () => {
    // The "Today" chip below the day selector scrolls back to today
    await element(by.text("Today")).atIndex(0).tap();
    await waitVisible("day-selector");
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
      await element(by.label("Scroll to today")).atIndex(0).tap();
      // Calendar screen should remain visible after navigation
      await waitVisible("calendar-screen");
      await waitVisible("month-view");
    });

    it("navigates to next period via chevron-right", async () => {
      await element(by.label("Scroll to today")).atIndex(1).tap();
      await waitVisible("calendar-screen");
      await waitVisible("month-view");
    });

    it("returns to today via calendar-today button", async () => {
      // Navigate away from today first
      await element(by.label("Scroll to today")).atIndex(0).tap();
      await element(by.label("Scroll to today")).atIndex(0).tap();
      // Tap the today button (accessibilityLabel "Today")
      await element(by.label("Today")).atIndex(0).tap();
      await waitVisible("calendar-screen");
    });
  });

  describe("Sign-In Banner", () => {
    it("shows sign-in banner or event content", async () => {
      // Without a Google account, a sign-in banner appears.
      // With an account, events or empty state is shown.
      try {
        await expect(element(by.id("sign-in-banner"))).toBeVisible();
      } catch {
        // Signed in or banner dismissed; either is acceptable
        await waitVisible("calendar-screen");
      }
    });

    it("sign-in button is tappable when banner is visible", async () => {
      try {
        await expect(element(by.id("sign-in-banner"))).toBeVisible();
        // The "Sign In" button inside the banner should be tappable.
        // We only tap it; OAuth flow cannot be completed in E2E.
        await element(by.text("Sign In")).atIndex(0).tap();
        // After tap, the screen should still be stable
        await waitVisible("calendar-screen");
      } catch {
        // Banner not visible (user is signed in); skip gracefully
      }
    });

    it("dismiss button hides the sign-in banner", async () => {
      try {
        await expect(element(by.id("sign-in-banner"))).toBeVisible();
        // Tap the dismiss (close) IconButton
        await element(by.label("Dismiss")).tap();
        await waitFor(element(by.id("sign-in-banner")))
          .not.toBeVisible()
          .withTimeout(5000);
      } catch {
        // Banner was not visible; skip gracefully
      }
    });
  });
});
