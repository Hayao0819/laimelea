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
        await waitFor(element(by.id(/^event-card-/)))
          .toBeVisible()
          .withTimeout(3000);
      } catch {
        console.log(
          "No calendar events available - skipping event detail test",
        );
        return;
      }

      await element(by.id(/^event-card-/))
        .atIndex(0)
        .tap();
      await waitVisible("event-detail-screen");
      await expect(element(by.id("create-alarm-button"))).toBeVisible();
      await device.pressBack();
      await waitVisible("calendar-screen");
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
        await waitFor(element(by.id(/^calendar-checkbox-/)))
          .toBeVisible()
          .withTimeout(3000);
      } catch {
        console.log("No calendar checkboxes available - skipping toggle test");
        return;
      }

      await element(by.id(/^calendar-checkbox-/))
        .atIndex(0)
        .tap();
      await element(by.id(/^calendar-checkbox-/))
        .atIndex(0)
        .tap();
    });
  });
});
