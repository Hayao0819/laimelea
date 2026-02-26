import { device, element, by, expect, waitFor } from "detox";
import {
  launchAppFresh,
  completeSetup,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

const TEST_LABEL = "E2E Test Alarm";
const EDITED_LABEL = "E2E Edited Alarm";

describe("Alarm CRUD", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Alarm");
    await waitVisible("alarm-list-screen");
  });

  describe("Empty State", () => {
    it("shows no alarms message", async () => {
      await expect(element(by.id("no-alarms-text"))).toBeVisible();
    });

    it("shows FAB group", async () => {
      await expect(element(by.id("alarm-fab-group"))).toBeVisible();
    });
  });

  describe("Create Alarm", () => {
    it("opens alarm edit screen via FAB", async () => {
      // Expand FAB group
      await element(by.id("alarm-fab-group")).tap();
      // Tap add alarm action
      await element(by.id("add-alarm-fab")).tap();
      await waitVisible("alarm-edit-screen");
    });

    it("sets alarm time", async () => {
      await expect(element(by.id("hours-input"))).toBeVisible();
      await expect(element(by.id("minutes-input"))).toBeVisible();

      await element(by.id("hours-input")).clearText();
      await element(by.id("hours-input")).typeText("8");
      await element(by.id("minutes-input")).clearText();
      await element(by.id("minutes-input")).typeText("30");
      await device.pressBack();
    });

    it("enters alarm label", async () => {
      await element(by.id("label-input")).typeText(TEST_LABEL);
      await device.pressBack();
    });

    it("changes dismissal method", async () => {
      await element(by.id("dismissal-method-item")).tap();
      await waitVisible("dismissal-dialog");
      await element(by.id("dismissal-option-shake")).tap();
      await waitFor(element(by.id("dismissal-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);
    });

    it("toggles vibration", async () => {
      await element(by.id("vibration-switch")).tap();
      await element(by.id("vibration-switch")).tap();
    });

    it("saves alarm and returns to list", async () => {
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");
      await expect(element(by.text(TEST_LABEL))).toBeVisible();
    });
  });

  describe("Read Alarm", () => {
    it("shows created alarm in list", async () => {
      await expect(element(by.text(TEST_LABEL))).toBeVisible();
    });
  });

  describe("Edit Alarm", () => {
    it("opens edit screen by tapping alarm card", async () => {
      await element(by.text(TEST_LABEL)).tap();
      await waitVisible("alarm-edit-screen");
    });

    it("changes label and saves", async () => {
      await element(by.id("label-input")).clearText();
      await element(by.id("label-input")).typeText(EDITED_LABEL);
      await device.pressBack();
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");
      await expect(element(by.text(EDITED_LABEL))).toBeVisible();
    });
  });

  describe("Toggle Alarm", () => {
    it("toggles alarm on/off via switch", async () => {
      // RN Paper's Switch renders as ReactSwitch on Android.
      // Use the native class name to find it.
      const alarmSwitch = element(
        by.type("com.facebook.react.views.switchview.ReactSwitch"),
      ).atIndex(0);
      await alarmSwitch.tap();
      await alarmSwitch.tap();
    });
  });

  describe("Delete Alarm", () => {
    it("deletes alarm via edit screen", async () => {
      await element(by.text(EDITED_LABEL)).tap();
      await waitVisible("alarm-edit-screen");
      await waitFor(element(by.id("delete-button")))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id("delete-button")).tap();

      // Confirm deletion in alert dialog
      await expect(element(by.text("Delete this alarm?"))).toBeVisible();
      await element(by.text("Delete")).tap();

      await waitFor(element(by.id("no-alarms-text")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
