import { device, element, by, expect, waitFor } from "detox";
import {
  launchAppFresh,
  completeSetup,
  waitVisible,
} from "./utils/helpers";

describe("Settings Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    // Appbar.Action for settings uses default testID="icon-button"
    await element(by.id("icon-button")).tap();
    await waitVisible("settings-screen");
  });

  describe("Cycle Configuration", () => {
    it("displays cycle length inputs", async () => {
      await waitVisible("cycle-hours-input");
      await waitVisible("cycle-minutes-input");
    });

    it("changes cycle hours", async () => {
      await element(by.id("cycle-hours-input")).clearText();
      await element(by.id("cycle-hours-input")).typeText("25");
      await device.pressBack();
    });

    it("shows cycle change warning", async () => {
      await expect(
        element(by.text("Changing cycle length will affect existing alarms")),
      ).toBeVisible();
    });

    it("shows Use Current Time button", async () => {
      await waitVisible("use-current-time-button");
    });

    it("shows base time item", async () => {
      await waitVisible("base-time-item");
    });
  });

  describe("Display Settings", () => {
    it("shows primary display segment", async () => {
      await waitVisible("primary-display-segment");
    });

    it("can toggle primary display", async () => {
      await element(by.text("24h")).atIndex(0).tap();
      await element(by.text("Custom")).tap();
    });
  });

  describe("General Settings", () => {
    it("shows language segment", async () => {
      await waitVisible("language-segment");
    });

    it("shows theme segment", async () => {
      await waitVisible("theme-segment");
    });

    it("can switch theme", async () => {
      await element(by.text("Dark")).tap();
      await element(by.text("System")).tap();
    });

    it("shows time format segment", async () => {
      await waitVisible("time-format-segment");
    });
  });

  describe("Timezone Settings", () => {
    it("shows timezone item", async () => {
      await waitVisible("timezone-item");
    });

    it("shows DST handling segment", async () => {
      await waitVisible("dst-segment");
    });

    it("shows secondary timezone item", async () => {
      await waitVisible("secondary-tz-item");
    });
  });

  describe("Alarm Defaults", () => {
    it("shows dismissal method segment", async () => {
      await waitVisible("dismissal-segment");
    });

    it("shows vibration setting", async () => {
      await waitVisible("vibration-item");
    });

    it("can toggle vibration switch", async () => {
      await element(by.id("vibration-switch")).tap();
      await element(by.id("vibration-switch")).tap();
    });

    it("shows volume button behavior segment", async () => {
      await waitVisible("volume-button-segment");
    });

    it("shows snooze settings", async () => {
      await waitVisible("snooze-duration-item");
      await waitVisible("snooze-max-item");
    });

    it("shows gradual volume setting", async () => {
      await waitVisible("gradual-volume-item");
    });
  });

  describe("Calendar Settings", () => {
    it("shows account item", async () => {
      // Scroll to calendar section
      await element(by.id("settings-screen")).scrollTo("bottom");
      await waitVisible("account-item");
    });

    it("shows first day of week segment", async () => {
      await waitVisible("first-day-segment");
    });

    it("shows default reminder item", async () => {
      await waitVisible("default-reminder-item");
    });
  });

  describe("Backup Section", () => {
    it("shows backup and restore buttons", async () => {
      await element(by.id("settings-screen")).scrollTo("bottom");
      await waitVisible("backup-now-button");
      await waitVisible("restore-button");
    });

    it("shows last backup status", async () => {
      await waitVisible("last-backup-item");
    });

    it("shows snackbar when tapping backup", async () => {
      await element(by.id("backup-now-button")).tap();
      await waitFor(element(by.id("settings-snackbar")))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
