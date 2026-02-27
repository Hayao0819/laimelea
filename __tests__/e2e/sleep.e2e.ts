import { device, element, by, expect, waitFor } from "detox";
import {
  launchAppFresh,
  completeSetup,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Sleep Log Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Sleep");
  });

  describe("Empty State", () => {
    it("displays sleep log screen", async () => {
      await waitVisible("sleep-log-screen");
    });

    it("shows no data message", async () => {
      await expect(element(by.text("No sleep data"))).toBeVisible();
    });

    it("shows FAB for manual entry", async () => {
      await waitVisible("add-sleep-fab");
    });

    it("shows empty cycle estimate card", async () => {
      await waitVisible("cycle-estimate-card-empty");
    });
  });

  describe("Manual Sleep Entry", () => {
    it("opens manual entry screen via FAB", async () => {
      await element(by.id("add-sleep-fab")).tap();
      await waitVisible("manual-sleep-entry-screen");
    });

    it("shows date and time inputs", async () => {
      await waitVisible("start-date-input");
      await waitVisible("start-time-input");
      await waitVisible("end-date-input");
      await waitVisible("end-time-input");
    });

    it("shows save button", async () => {
      await waitVisible("save-button");
    });

    it("enters sleep data and saves", async () => {
      await element(by.id("start-date-input")).clearText();
      await element(by.id("start-date-input")).typeText("2026-02-25");
      await element(by.id("start-time-input")).clearText();
      await element(by.id("start-time-input")).typeText("23:00");
      await element(by.id("end-date-input")).clearText();
      await element(by.id("end-date-input")).typeText("2026-02-26");
      await element(by.id("end-time-input")).clearText();
      await element(by.id("end-time-input")).typeText("07:00");

      // Dismiss keyboard
      await device.pressBack();

      await element(by.id("save-button")).tap();
    });

    it("returns to sleep log with new entry", async () => {
      await waitVisible("sleep-log-screen");
      await expect(element(by.text("2026-02-25"))).toBeVisible();
      await expect(element(by.text("8h 0m"))).toBeVisible();
    });
  });

  describe("Sleep Entry Display", () => {
    it("shows entry with correct times", async () => {
      await expect(element(by.text("23:00"))).toBeVisible();
      await expect(element(by.text("07:00"))).toBeVisible();
    });

    it("shows Manual source label", async () => {
      await expect(element(by.text("Manual"))).toBeVisible();
    });
  });

  describe("Delete Sleep Entry", () => {
    it("opens delete dialog via long press", async () => {
      await element(by.text("2026-02-25")).longPress();
      await waitVisible("delete-dialog");
    });

    it("cancels deletion", async () => {
      await element(by.text("Cancel")).tap();
      await waitFor(element(by.id("delete-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);
      // Entry should still exist
      await expect(element(by.text("2026-02-25"))).toBeVisible();
    });

    it("deletes entry via long press and confirm", async () => {
      await element(by.text("2026-02-25")).longPress();
      await waitVisible("delete-dialog");
      await element(by.id("confirm-delete-button")).tap();
      await waitFor(element(by.id("delete-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);
      // Empty state should return
      await expect(element(by.text("No sleep data"))).toBeVisible();
    });
  });
});
