import { device, element, by, expect } from "detox";
import { launchAppFresh, launchApp, waitVisible } from "./utils/helpers";

describe("Setup Flow", () => {
  beforeAll(async () => {
    await launchAppFresh();
  });

  it("shows setup screen on first launch", async () => {
    await waitVisible("cycle-hours");
    await expect(element(by.id("cycle-hours"))).toBeVisible();
    await expect(element(by.id("cycle-minutes"))).toBeVisible();
    await expect(element(by.id("done-button"))).toBeVisible();
  });

  it("allows editing cycle time", async () => {
    await element(by.id("cycle-hours")).clearText();
    await element(by.id("cycle-hours")).typeText("25");
    await element(by.id("cycle-minutes")).clearText();
    await element(by.id("cycle-minutes")).typeText("30");
    await device.pressBack();

    await expect(element(by.id("cycle-hours"))).toHaveText("25");
    await expect(element(by.id("cycle-minutes"))).toHaveText("30");
  });

  it("sets base time with Use Current Time button", async () => {
    await element(by.text("Use Current Time")).tap();
    // Preview section should appear after setting base time
    await expect(element(by.text("Current custom time"))).toBeVisible();
  });

  it("completes setup and navigates to MainTabs", async () => {
    await element(by.id("done-button")).tap();
    await waitVisible("clock-screen");
    await expect(element(by.id("clock-screen"))).toBeVisible();
  });

  it("skips setup on subsequent launches", async () => {
    await launchApp();
    await waitVisible("clock-screen");
    await expect(element(by.id("clock-screen"))).toBeVisible();
  });
});
