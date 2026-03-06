import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Alarm Extras", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Alarm");
    await waitVisible("alarm-list-screen");
  });

  describe("LongPress Delete", () => {
    it("creates an alarm for longpress test", async () => {
      // Expand FAB group and tap add alarm
      await element(by.id("alarm-fab-group")).tap();
      await element(by.id("add-alarm-fab")).tap();
      await waitVisible("alarm-edit-screen");

      // Enter label
      await element(by.id("label-input")).typeText("E2E LongPress Test");
      await device.pressBack();

      // Save alarm and return to list
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");
      await expect(element(by.text("E2E LongPress Test"))).toBeVisible();
    });

    it("deletes alarm via long press on alarm card", async () => {
      // Long press the alarm card label to trigger instant deletion
      await element(by.text("E2E LongPress Test")).longPress();

      // No confirmation dialog — alarm is deleted immediately
      await waitFor(element(by.id("no-alarms-text")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe("Test Alarm Button", () => {
    it("creates alarm to access test button", async () => {
      // Expand FAB group and tap add alarm
      await element(by.id("alarm-fab-group")).tap();
      await element(by.id("add-alarm-fab")).tap();
      await waitVisible("alarm-edit-screen");

      // Enter label
      await element(by.id("label-input")).typeText("E2E Test Alarm");
      await device.pressBack();
    });

    it("taps test alarm button and shows snackbar", async () => {
      // Scroll down to ensure test alarm button is visible
      await element(by.id("alarm-edit-screen")).scrollTo("bottom");

      // Tap the test alarm button
      await element(by.id("test-alarm-button")).tap();

      // Wait for the snackbar confirming the test alarm was scheduled
      await waitVisible("test-alarm-snackbar");
    });

    it("saves alarm and cleans up", async () => {
      // Save the alarm and return to list
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");

      // Delete alarm via long press
      await element(by.text("E2E Test Alarm")).longPress();

      // Wait for empty state
      await waitFor(element(by.id("no-alarms-text")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
