import { element, by, expect } from "detox";
import {
  launchAppFresh,
  completeSetup,
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
});
