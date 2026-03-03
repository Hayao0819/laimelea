import { by, element, expect } from "detox";

import { completeSetup, launchAppFresh, waitVisible } from "./utils/helpers";

describe("Clock Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
  });

  it("displays all clock components", async () => {
    await waitVisible("clock-screen");
    await expect(element(by.id("analog-clock"))).toBeVisible();
    await expect(element(by.id("digital-clock"))).toBeVisible();
    await expect(element(by.id("time-toggle"))).toBeVisible();
    await expect(element(by.id("custom-day-indicator"))).toBeVisible();
  });

  it("toggles between custom and 24h time display", async () => {
    // Tap "24h Time" to switch mode
    await element(by.text("24h Time")).tap();
    // Tap "Custom Time" to switch back
    await element(by.text("Custom Time")).tap();
  });

  it("shows custom day indicator", async () => {
    await expect(element(by.id("custom-day-indicator"))).toBeVisible();
  });
});
