import { by, device, element, expect } from "detox";

import { completeSetup, launchAppFresh, waitVisible } from "./utils/helpers";

describe("Clock Extras", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await waitVisible("clock-screen");
  });

  describe("Clock Mode Toggle", () => {
    it("shows analog clock by default", async () => {
      await expect(element(by.id("analog-clock"))).toBeVisible();
      await expect(element(by.id("digital-clock"))).toBeVisible();
    });

    it("switches to digital only mode on tap", async () => {
      await element(by.id("clock-mode-toggle-area")).tap();
      await expect(element(by.id("analog-clock"))).not.toBeVisible();
      await expect(element(by.id("digital-clock"))).toBeVisible();
    });

    it("switches back to analog mode on tap", async () => {
      await element(by.id("clock-mode-toggle-area")).tap();
      await expect(element(by.id("analog-clock"))).toBeVisible();
      await expect(element(by.id("digital-clock"))).toBeVisible();
    });
  });

  describe("Desk Clock Landscape", () => {
    it("navigates to desk clock", async () => {
      await element(by.label("Desk clock")).tap();
      await waitVisible("desk-clock-screen");
    });

    it("rotates to landscape", async () => {
      await device.setOrientation("landscape");
      await expect(element(by.id("desk-clock-screen"))).toBeVisible();
      await expect(element(by.id("desk-clock-close"))).toBeVisible();
    });

    it("returns to portrait and closes desk clock", async () => {
      await device.setOrientation("portrait");
      await expect(element(by.id("desk-clock-screen"))).toBeVisible();
      await element(by.id("desk-clock-close")).tap();
      await waitVisible("clock-screen");
    });
  });
});
