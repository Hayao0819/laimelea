import { by, device, element, expect, waitFor } from "detox";

import { completeSetup, launchAppFresh, waitVisible } from "./utils/helpers";

describe("Timezone Picker", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
  });

  describe("Navigate to Timezone Settings", () => {
    it("opens timezone settings screen", async () => {
      await element(by.id("appbar-settings-button")).tap();
      await waitVisible("settings-screen");
      await element(by.id("settings-timezone-item")).tap();
      await waitVisible("timezone-settings-screen");
    });
  });

  describe("Primary Timezone Picker", () => {
    it("opens timezone picker modal", async () => {
      await element(by.id("timezone-item")).tap();
      await waitVisible("timezone-picker-modal");
    });

    it("shows search bar", async () => {
      await waitVisible("timezone-searchbar");
    });

    it("searches for a timezone", async () => {
      await element(by.id("timezone-searchbar")).typeText("Tokyo");
      await device.pressBack();
      await waitVisible("tz-item-Asia/Tokyo");
    });

    it("hides non-matching timezones", async () => {
      await expect(element(by.id("tz-item-Europe/London"))).not.toBeVisible();
    });

    it("selects a timezone", async () => {
      await element(by.id("tz-item-Asia/Tokyo")).tap();
      await waitFor(element(by.id("timezone-picker-modal")))
        .not.toBeVisible()
        .withTimeout(5000);
    });

    it("shows selected timezone in description", async () => {
      await expect(element(by.text("Asia/Tokyo"))).toBeVisible();
    });
  });

  describe("Secondary Timezone Picker", () => {
    it("opens secondary timezone picker", async () => {
      await element(by.id("secondary-tz-item")).tap();
      await waitVisible("timezone-picker-modal");
    });

    it("searches and selects secondary timezone", async () => {
      await element(by.id("timezone-searchbar")).typeText("London");
      await device.pressBack();
      await waitVisible("tz-item-Europe/London");
      await element(by.id("tz-item-Europe/London")).tap();
      await waitFor(element(by.id("timezone-picker-modal")))
        .not.toBeVisible()
        .withTimeout(5000);
    });

    it("shows selected secondary timezone in description", async () => {
      await expect(element(by.text("Europe/London"))).toBeVisible();
    });
  });

  describe("Picker dismissal without selection", () => {
    it("dismisses picker via back button without changing timezone", async () => {
      await element(by.id("timezone-item")).tap();
      await waitVisible("timezone-picker-modal");
      await device.pressBack();
      await waitFor(element(by.id("timezone-picker-modal")))
        .not.toBeVisible()
        .withTimeout(5000);
      // Primary timezone should still be Asia/Tokyo
      await expect(element(by.text("Asia/Tokyo"))).toBeVisible();
    });
  });

  describe("Search reset after close", () => {
    it("clears search query when picker reopens", async () => {
      // Open picker, search, then close without selecting
      await element(by.id("timezone-item")).tap();
      await waitVisible("timezone-picker-modal");
      await element(by.id("timezone-searchbar")).typeText("xyz");
      await device.pressBack();
      await device.pressBack();
      await waitFor(element(by.id("timezone-picker-modal")))
        .not.toBeVisible()
        .withTimeout(5000);

      // Reopen — all timezones should be visible (search was cleared)
      await element(by.id("timezone-item")).tap();
      await waitVisible("timezone-picker-modal");
      await waitVisible("tz-item-Asia/Tokyo");
      await waitVisible("tz-item-Europe/London");

      // Close
      await device.pressBack();
      await waitFor(element(by.id("timezone-picker-modal")))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });

  afterAll(async () => {
    await device.pressBack();
    await waitVisible("settings-screen");
  });
});
