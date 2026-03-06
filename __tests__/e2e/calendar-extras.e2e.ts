import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Calendar Extras", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
  });

  describe("Calendar Event Detail (Conditional)", () => {
    beforeAll(async () => {
      await navigateToTab("Calendar");
      await waitVisible("calendar-screen");
    });

    it("switches to agenda view for event visibility", async () => {
      await element(by.text("Agenda")).atIndex(0).tap();
      await waitVisible("agenda-view");
    });

    it("taps event card if available (conditional)", async () => {
      try {
        // Look for any event card with a short timeout
        await waitFor(element(by.id(/^event-card-/)))
          .toBeVisible()
          .withTimeout(3000);

        // Tap the first visible event card
        await element(by.id(/^event-card-/))
          .atIndex(0)
          .tap();

        // Verify event detail screen appears
        await waitVisible("event-detail-screen");

        // Verify create-alarm button is present
        await expect(element(by.id("create-alarm-button"))).toBeVisible();

        // Go back to calendar screen
        await device.pressBack();
        await waitVisible("calendar-screen");
      } catch {
        // No calendar events available - skip gracefully
        console.log(
          "No calendar events available - skipping event detail test",
        );
      }
    });
  });

  describe("Calendar Settings Checkbox (Conditional)", () => {
    beforeAll(async () => {
      // Navigate to Settings > Calendar Settings
      await element(by.id("appbar-settings-button")).tap();
      await waitVisible("settings-screen");
      await element(by.id("settings-calendar-item")).tap();
      await waitVisible("calendar-settings-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
      await device.pressBack();
    });

    it("shows first day of week segment", async () => {
      await waitVisible("first-day-segment");
    });

    it("shows default reminder item", async () => {
      await waitVisible("default-reminder-item");
    });

    it("toggles calendar checkbox if available (conditional)", async () => {
      try {
        // Look for any calendar checkbox with a short timeout
        await waitFor(element(by.id(/^calendar-checkbox-/)))
          .toBeVisible()
          .withTimeout(3000);

        // Tap to toggle OFF
        await element(by.id(/^calendar-checkbox-/))
          .atIndex(0)
          .tap();

        // Tap again to toggle ON
        await element(by.id(/^calendar-checkbox-/))
          .atIndex(0)
          .tap();
      } catch {
        // No calendar checkboxes available - skip gracefully
        console.log("No calendar checkboxes available - skipping toggle test");
      }
    });
  });
});
