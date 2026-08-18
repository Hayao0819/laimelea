import { by, device, element, expect } from "detox";

import { completeSetup, launchAppFresh, waitVisible } from "./utils/helpers";

async function waitForDeskClockLayout(orientation: "landscape" | "portrait") {
  const deadline = Date.now() + 10_000;
  let stableReadings = 0;

  while (Date.now() < deadline) {
    const screen = await element(by.id("desk-clock-screen")).getAttributes();
    const close = await element(by.id("desk-clock-close")).getAttributes();

    if (!("elements" in screen) && !("elements" in close)) {
      const isLandscape = screen.frame.width > screen.frame.height;
      const closeWithinScreen =
        close.frame.x >= screen.frame.x &&
        close.frame.y >= screen.frame.y &&
        close.frame.x + close.frame.width <=
          screen.frame.x + screen.frame.width &&
        close.frame.y + close.frame.height <=
          screen.frame.y + screen.frame.height;

      if (isLandscape === (orientation === "landscape") && closeWithinScreen) {
        stableReadings += 1;
        if (stableReadings >= 5) return;
      } else {
        stableReadings = 0;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Desk clock did not settle in ${orientation}`);
}

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
      await waitForDeskClockLayout("landscape");
      await expect(element(by.id("desk-clock-screen"))).toBeVisible();
      await expect(element(by.id("desk-clock-close"))).toBeVisible();
    });

    it("returns to portrait and closes desk clock", async () => {
      await device.setOrientation("portrait");
      await waitForDeskClockLayout("portrait");
      await expect(element(by.id("desk-clock-screen"))).toBeVisible();
      await element(by.id("desk-clock-close")).tap();
      await waitVisible("clock-screen");
    });
  });
});
