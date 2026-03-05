import { by, device, element, expect } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Tab Navigation", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
  });

  it("shows Clock tab by default", async () => {
    await waitVisible("clock-screen");
    await expect(element(by.id("clock-screen"))).toBeVisible();
  });

  it("navigates to Alarm tab", async () => {
    await navigateToTab("Alarm");
    await waitVisible("alarm-list-screen");
    await expect(element(by.id("alarm-list-screen"))).toBeVisible();
  });

  it("navigates to Calendar tab", async () => {
    await navigateToTab("Calendar");
    // Calendar is a stub screen, just verify navigation works
    await expect(element(by.text("Calendar")).atIndex(0)).toBeVisible();
  });

  it("navigates to Sleep tab", async () => {
    await navigateToTab("Sleep");
    await expect(element(by.text("Sleep")).atIndex(0)).toBeVisible();
  });

  it("navigates to Timer tab", async () => {
    await navigateToTab("Timer");
    await expect(element(by.text("Timer")).atIndex(0)).toExist();
  });

  it("returns to Clock tab", async () => {
    await navigateToTab("Clock");
    await waitVisible("clock-screen");
    await expect(element(by.id("clock-screen"))).toBeVisible();
  });

  it("opens Settings from appbar gear icon", async () => {
    await element(by.id("appbar-settings-button")).tap();
    // "Settings" text appears in both RN and native toolbar views
    await expect(element(by.text("Settings")).atIndex(0)).toBeVisible();
    // Go back to main tabs
    await device.pressBack();
    await waitVisible("clock-screen");
  });
});
