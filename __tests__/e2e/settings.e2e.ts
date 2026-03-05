import { by, device, element, expect, waitFor } from "detox";

import { completeSetup, launchAppFresh, waitVisible } from "./utils/helpers";

describe("Settings Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await element(by.id("appbar-settings-button")).tap();
    await waitVisible("settings-screen");
  });

  describe("Hub", () => {
    it("displays hub menu items", async () => {
      await waitVisible("settings-cycle-config-item");
      await waitVisible("settings-general-item");
      await waitVisible("settings-alarm-defaults-item");
    });

    it("displays more hub items on scroll", async () => {
      await element(by.id("settings-screen")).scrollTo("bottom");
      await waitVisible("settings-backup-item");
      await element(by.id("settings-screen")).scrollTo("top");
    });
  });

  describe("Cycle Configuration", () => {
    beforeAll(async () => {
      await element(by.id("settings-cycle-config-item")).tap();
      await waitVisible("cycle-config-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

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

  describe("General & Display Settings", () => {
    beforeAll(async () => {
      await element(by.id("settings-general-item")).tap();
      await waitVisible("general-settings-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

    it("shows primary display segment", async () => {
      await waitVisible("primary-display-segment");
    });

    it("can toggle primary display", async () => {
      await element(by.text("24h")).atIndex(0).tap();
      await element(by.text("Custom")).tap();
    });

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
    beforeAll(async () => {
      await element(by.id("settings-timezone-item")).tap();
      await waitVisible("timezone-settings-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

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
    beforeAll(async () => {
      await element(by.id("settings-alarm-defaults-item")).tap();
      await waitVisible("alarm-defaults-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

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
    beforeAll(async () => {
      await element(by.id("settings-calendar-item")).tap();
      await waitVisible("calendar-settings-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

    it("shows first day of week segment", async () => {
      await waitVisible("first-day-segment");
    });

    it("shows default reminder item", async () => {
      await waitVisible("default-reminder-item");
    });
  });

  describe("Backup Section", () => {
    beforeAll(async () => {
      await element(by.id("settings-screen")).scrollTo("bottom");
      await element(by.id("settings-backup-item")).tap();
      await waitVisible("backup-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

    it("shows backup and restore buttons", async () => {
      await waitVisible("backup-now-button");
      await waitVisible("restore-button");
    });

    it("shows last backup status", async () => {
      await waitVisible("last-backup-item");
    });

    it("shows snackbar when tapping backup", async () => {
      await element(by.id("backup-now-button")).tap();
      await waitFor(element(by.id("backup-snackbar")))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe("Widget Settings", () => {
    beforeAll(async () => {
      await element(by.id("settings-screen")).scrollTo("bottom");
      await element(by.id("settings-widget-item")).tap();
      await waitVisible("widget-settings-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

    it("shows color input fields", async () => {
      await waitVisible("widget-bg-color-input");
      await waitVisible("widget-text-color-input");
    });

    it("shows color previews", async () => {
      await waitVisible("widget-bg-color-preview");
      await waitVisible("widget-text-color-preview");
    });

    it("shows additional color inputs on scroll", async () => {
      await element(by.id("widget-settings-screen")).scrollTo("bottom");
      await waitVisible("widget-secondary-color-input");
      await waitVisible("widget-accent-color-input");
    });

    it("shows opacity input", async () => {
      await waitVisible("widget-opacity-input");
    });

    it("can toggle border radius switch", async () => {
      await element(by.id("widget-settings-screen")).scrollTo("bottom");
      await waitVisible("widget-border-radius-item");
      await element(by.id("widget-border-radius-switch")).tap();
      await element(by.id("widget-border-radius-switch")).tap();
    });

    it("can toggle show real time switch", async () => {
      await waitVisible("widget-show-real-time-item");
      await element(by.id("widget-show-real-time-switch")).tap();
      await element(by.id("widget-show-real-time-switch")).tap();
    });

    it("can toggle show next alarm switch", async () => {
      await waitVisible("widget-show-next-alarm-item");
      await element(by.id("widget-show-next-alarm-switch")).tap();
      await element(by.id("widget-show-next-alarm-switch")).tap();
    });
  });

  describe("About Screen", () => {
    beforeAll(async () => {
      await element(by.id("settings-screen")).scrollTo("bottom");
      await element(by.id("settings-about-item")).tap();
      await waitVisible("about-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

    it("shows version item", async () => {
      await waitVisible("version-item");
    });

    it("shows developer info", async () => {
      await waitVisible("developer-item");
    });

    it("shows repository and social links", async () => {
      await waitVisible("github-item");
      await waitVisible("twitter-item");
    });
  });

  describe("Legal Screen", () => {
    beforeAll(async () => {
      await element(by.id("settings-screen")).scrollTo("bottom");
      await element(by.id("settings-legal-item")).tap();
      await waitVisible("legal-screen");
    });

    afterAll(async () => {
      await device.pressBack();
      await waitVisible("settings-screen");
    });

    it("shows license items", async () => {
      await waitVisible("mit-license-item");
      await waitVisible("mit-sushi-license-item");
    });

    it("shows privacy policy item", async () => {
      await waitVisible("privacy-policy-item");
    });

    it("navigates to licenses screen", async () => {
      await element(by.id("licenses-item")).tap();
      await waitVisible("licenses-screen");
      await device.pressBack();
      await waitVisible("legal-screen");
    });
  });
});
