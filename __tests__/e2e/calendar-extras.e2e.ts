import { by, device, element, expect } from "detox";

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

  describe("Calendar Event Views", () => {
    beforeAll(async () => {
      await navigateToTab("Calendar");
      await waitVisible("calendar-screen");
    });

    it("switches to agenda view for event visibility", async () => {
      await element(by.text("Agenda")).atIndex(0).tap();
      await waitVisible("agenda-view");
    });

    it("keeps the agenda view available without external calendar data", async () => {
      await expect(element(by.id("agenda-view"))).toBeVisible();
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
  });
});
