import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
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

const REPEAT_ALARM_LABEL = "E2E Repeat Alarm";
const SOUND_ALARM_LABEL = "E2E Sound Alarm";
const PREVIEW_ALARM_LABEL = "E2E Preview Alarm";

describe("Alarm Edit - New Features", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Alarm");
    await waitVisible("alarm-list-screen");
  });

  describe("Repeat Picker", () => {
    it("should open alarm edit and set weekday repeat", async () => {
      // Create new alarm via FAB
      await element(by.id("alarm-fab-group")).tap();
      await element(by.id("add-alarm-fab")).tap();
      await waitVisible("alarm-edit-screen");

      // Enter label
      await element(by.id("label-input")).typeText(REPEAT_ALARM_LABEL);
      await device.pressBack();

      // Tap repeat picker to expand
      await element(by.id("repeat-picker-item")).tap();

      // Select "Weekdays" mode
      await waitVisible("repeat-mode-weekdays");
      await element(by.id("repeat-mode-weekdays")).tap();

      // Verify weekday chips appear
      await waitVisible("weekday-chips");

      // Tap Monday (1), Wednesday (3), Friday (5)
      await element(by.id("weekday-chip-1")).tap();
      await element(by.id("weekday-chip-3")).tap();
      await element(by.id("weekday-chip-5")).tap();

      // Save alarm
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");

      // Verify alarm card shows label
      await expect(element(by.text(REPEAT_ALARM_LABEL))).toBeVisible();

      // Verify repeat info is shown on the alarm card
      await expect(element(by.text("Mon, Wed, Fri"))).toBeVisible();
    });

    it("should set interval repeat", async () => {
      // Edit the alarm we just created
      await element(by.text(REPEAT_ALARM_LABEL)).tap();
      await waitVisible("alarm-edit-screen");

      // Expand repeat picker
      await element(by.id("repeat-picker-item")).tap();

      // Select "Interval" mode
      await waitVisible("repeat-mode-interval");
      await element(by.id("repeat-mode-interval")).tap();

      // Enter interval hours
      await waitVisible("interval-input");
      await element(by.id("interval-input")).clearText();
      await element(by.id("interval-input")).typeText("12");
      await device.pressBack();

      // Save alarm
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");

      // Verify alarm is saved (card is visible)
      await expect(element(by.text(REPEAT_ALARM_LABEL))).toBeVisible();
    });

    it("should clear repeat setting", async () => {
      // Edit alarm with repeat
      await element(by.text(REPEAT_ALARM_LABEL)).tap();
      await waitVisible("alarm-edit-screen");

      // Expand repeat picker
      await element(by.id("repeat-picker-item")).tap();

      // Select "None" mode
      await waitVisible("repeat-mode-none");
      await element(by.id("repeat-mode-none")).tap();

      // Save alarm
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");

      // Verify alarm is saved without repeat indicator
      await expect(element(by.text(REPEAT_ALARM_LABEL))).toBeVisible();
    });

    afterAll(async () => {
      // Clean up: delete the test alarm
      await element(by.text(REPEAT_ALARM_LABEL)).tap();
      await waitVisible("alarm-edit-screen");
      await waitFor(element(by.id("delete-button")))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id("delete-button")).tap();
      await expect(element(by.text("Delete this alarm?"))).toBeVisible();
      await element(by.text("Delete")).tap();
      await waitFor(element(by.id("no-alarms-text")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe("Sound Picker", () => {
    it("should open sound picker dialog and select default", async () => {
      // Create new alarm
      await element(by.id("alarm-fab-group")).tap();
      await element(by.id("add-alarm-fab")).tap();
      await waitVisible("alarm-edit-screen");

      // Enter label
      await element(by.id("label-input")).typeText(SOUND_ALARM_LABEL);
      await device.pressBack();

      // Tap sound selection item
      await element(by.id("sound-picker-item")).tap();

      // Verify dialog opens
      await waitVisible("sound-picker-dialog");

      // Select "Default" option
      await element(by.id("sound-option-default")).tap();

      // Dialog should dismiss after selection
      await waitFor(element(by.id("sound-picker-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);

      // Save alarm
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");
      await expect(element(by.text(SOUND_ALARM_LABEL))).toBeVisible();
    });

    it("should select silent option", async () => {
      // Edit alarm
      await element(by.text(SOUND_ALARM_LABEL)).tap();
      await waitVisible("alarm-edit-screen");

      // Tap sound selection
      await element(by.id("sound-picker-item")).tap();
      await waitVisible("sound-picker-dialog");

      // Select "Silent"
      await element(by.id("sound-option-silent")).tap();

      // Dialog should dismiss
      await waitFor(element(by.id("sound-picker-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);

      // Verify sound description updated to "Silent"
      await expect(element(by.text("Silent"))).toBeVisible();

      // Save alarm
      await element(by.id("save-button")).tap();
      await waitVisible("alarm-list-screen");
      await expect(element(by.text(SOUND_ALARM_LABEL))).toBeVisible();
    });

    afterAll(async () => {
      // Clean up: delete the test alarm
      await element(by.text(SOUND_ALARM_LABEL)).tap();
      await waitVisible("alarm-edit-screen");
      await waitFor(element(by.id("delete-button")))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id("delete-button")).tap();
      await expect(element(by.text("Delete this alarm?"))).toBeVisible();
      await element(by.text("Delete")).tap();
      await waitFor(element(by.id("no-alarms-text")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe("Preview", () => {
    it("should show full-screen preview from edit screen", async () => {
      // Create new alarm
      await element(by.id("alarm-fab-group")).tap();
      await element(by.id("add-alarm-fab")).tap();
      await waitVisible("alarm-edit-screen");

      // Enter label
      await element(by.id("label-input")).typeText(PREVIEW_ALARM_LABEL);
      await device.pressBack();

      // Tap "Show Preview" button
      await element(by.id("preview-button")).tap();

      // Verify AlarmFiring preview screen appears
      await waitVisible("alarm-firing-screen");

      // Verify "Preview" badge is visible
      await expect(element(by.id("preview-badge"))).toBeVisible();

      // Tap "Close" button
      await element(by.id("close-preview-button")).tap();

      // Verify return to edit screen
      await waitVisible("alarm-edit-screen");
    });

    afterAll(async () => {
      // Clean up: go back without saving if still on edit screen
      await device.pressBack();
      await waitFor(element(by.id("alarm-list-screen")))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
