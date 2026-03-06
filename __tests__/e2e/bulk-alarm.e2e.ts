import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

const BULK_LABEL = "E2E Bulk Test";

describe("Bulk Alarm", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Alarm");
    await waitVisible("alarm-list-screen");
  });

  describe("Navigation", () => {
    it("opens bulk alarm screen via FAB", async () => {
      // Expand FAB group
      await element(by.id("alarm-fab-group")).tap();
      // Tap bulk create action
      await element(by.id("bulk-create-fab")).tap();
      await waitVisible("bulk-alarm-screen");
    });
  });

  describe("Form Inputs", () => {
    it("shows interval input", async () => {
      await waitVisible("interval-input");
    });

    it("shows label input", async () => {
      await waitVisible("bulk-label-input");
    });

    it("enters label", async () => {
      await element(by.id("bulk-label-input")).typeText(BULK_LABEL);
      await device.pressBack();
    });

    it("changes interval", async () => {
      await element(by.id("interval-input")).clearText();
      await element(by.id("interval-input")).typeText("60");
      await device.pressBack();
    });

    it("shows dismissal method item", async () => {
      await waitVisible("bulk-dismissal-item");
    });

    it("changes dismissal method", async () => {
      await element(by.id("bulk-dismissal-item")).tap();
      await waitVisible("bulk-dismissal-dialog");
      await element(by.id("bulk-dismissal-option-shake")).tap();
      await waitFor(element(by.id("bulk-dismissal-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });

  describe("Preview", () => {
    it("shows preview section with alarm count", async () => {
      // Default from=7:00, to=9:00 with interval=60 produces 3 alarms (7:00, 8:00, 9:00)
      await expect(
        element(by.text("3 alarms will be created")),
      ).toBeVisible();
    });
  });

  describe("Save", () => {
    it("saves bulk alarms and returns to list", async () => {
      await element(by.id("bulk-save-button")).tap();
      await waitVisible("alarm-list-screen");
      // At least one alarm with the label should appear in the list
      await expect(element(by.text(BULK_LABEL)).atIndex(0)).toBeVisible();
    });
  });

  describe("Cleanup", () => {
    it("deletes all bulk-created alarms", async () => {
      // Long press each alarm card to delete it.
      // With 3 alarms created, we need to delete 3 times.
      for (let i = 0; i < 3; i++) {
        await waitFor(element(by.text(BULK_LABEL)).atIndex(0))
          .toBeVisible()
          .withTimeout(5000);
        await element(by.text(BULK_LABEL)).atIndex(0).longPress();
      }

      // Verify we are back to empty state
      await waitFor(element(by.id("no-alarms-text")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
