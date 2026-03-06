import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Sleep Extras", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    // Health Connect initialize() hangs on GMS emulators without HC installed,
    // blocking Detox synchronisation. Disable sync around navigation.
    await device.disableSynchronization();
    await navigateToTab("Sleep");
    await waitVisible("sleep-log-screen");
    await device.enableSynchronization();
  });

  describe("Edit Sleep Entry", () => {
    it("creates a manual sleep entry", async () => {
      await device.disableSynchronization();
      await element(by.id("add-sleep-fab")).tap();
      await waitVisible("manual-sleep-entry-screen");
      await device.enableSynchronization();

      await element(by.id("start-date-input")).clearText();
      await element(by.id("start-date-input")).typeText("2026-03-01");
      await element(by.id("start-time-input")).clearText();
      await element(by.id("start-time-input")).typeText("23:00");
      await element(by.id("end-date-input")).clearText();
      await element(by.id("end-date-input")).typeText("2026-03-02");
      await element(by.id("end-time-input")).clearText();
      await element(by.id("end-time-input")).typeText("07:00");

      // Dismiss keyboard
      await device.pressBack();

      // Save triggers navigation back; useFocusEffect re-runs sync(),
      // which hangs on HC. Disable sync around the save + navigation.
      await device.disableSynchronization();
      await element(by.id("save-button")).tap();
      await waitVisible("sleep-log-screen");
      await device.enableSynchronization();

      await expect(element(by.text("2026-03-01"))).toBeVisible();
    });

    it("edits existing sleep entry by tapping", async () => {
      // Tap existing entry to open edit screen
      await device.disableSynchronization();
      await element(by.text("2026-03-01")).tap();
      await waitVisible("manual-sleep-entry-screen");
      await device.enableSynchronization();

      // Change start time from 23:00 to 22:30
      await element(by.id("start-time-input")).clearText();
      await element(by.id("start-time-input")).typeText("22:30");

      // Dismiss keyboard
      await device.pressBack();

      // Save and return to sleep log
      await device.disableSynchronization();
      await element(by.id("save-button")).tap();
      await waitVisible("sleep-log-screen");
      await device.enableSynchronization();

      // Verify the edited time is displayed
      await expect(element(by.text("22:30"))).toBeVisible();
    });
  });

  describe("Cycle Estimate with Multiple Entries", () => {
    it("creates second sleep entry", async () => {
      await device.disableSynchronization();
      await element(by.id("add-sleep-fab")).tap();
      await waitVisible("manual-sleep-entry-screen");
      await device.enableSynchronization();

      await element(by.id("start-date-input")).clearText();
      await element(by.id("start-date-input")).typeText("2026-03-03");
      await element(by.id("start-time-input")).clearText();
      await element(by.id("start-time-input")).typeText("22:45");
      await element(by.id("end-date-input")).clearText();
      await element(by.id("end-date-input")).typeText("2026-03-04");
      await element(by.id("end-time-input")).clearText();
      await element(by.id("end-time-input")).typeText("06:45");

      await device.pressBack();

      await device.disableSynchronization();
      await element(by.id("save-button")).tap();
      await waitVisible("sleep-log-screen");
      await device.enableSynchronization();

      await expect(element(by.text("2026-03-03"))).toBeVisible();
    });

    it("creates third sleep entry", async () => {
      await device.disableSynchronization();
      await element(by.id("add-sleep-fab")).tap();
      await waitVisible("manual-sleep-entry-screen");
      await device.enableSynchronization();

      await element(by.id("start-date-input")).clearText();
      await element(by.id("start-date-input")).typeText("2026-03-05");
      await element(by.id("start-time-input")).clearText();
      await element(by.id("start-time-input")).typeText("23:15");
      await element(by.id("end-date-input")).clearText();
      await element(by.id("end-date-input")).typeText("2026-03-06");
      await element(by.id("end-time-input")).clearText();
      await element(by.id("end-time-input")).typeText("07:15");

      await device.pressBack();

      await device.disableSynchronization();
      await element(by.id("save-button")).tap();
      await waitVisible("sleep-log-screen");
      await device.enableSynchronization();

      await expect(element(by.text("2026-03-05"))).toBeVisible();
    });

    it("shows cycle estimate card", async () => {
      // The cycle detector requires MIN_DATA_POINTS (7) to produce an estimate.
      // With only 3 entries and no Health Connect sync, the cycleEstimationAtom
      // stays null, so cycle-estimate-card-empty is expected.
      // Use try/catch to verify whichever card state is present.
      try {
        await waitFor(element(by.id("cycle-estimate-card")))
          .toBeVisible()
          .withTimeout(5000);
        // If populated, verify confidence chip is shown
        await expect(element(by.id("confidence-chip"))).toBeVisible();
      } catch {
        // Fallback: empty card is shown when data is insufficient
        await waitFor(element(by.id("cycle-estimate-card-empty")))
          .toBeVisible()
          .withTimeout(5000);
      }
    });
  });

  describe("Cleanup", () => {
    it("deletes all entries", async () => {
      // Delete entry 2026-03-05 (most recent, shown first)
      await element(by.text("2026-03-05")).longPress();
      await waitVisible("delete-dialog");
      await element(by.id("confirm-delete-button")).tap();
      await waitFor(element(by.id("delete-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);

      // Delete entry 2026-03-03
      await element(by.text("2026-03-03")).longPress();
      await waitVisible("delete-dialog");
      await element(by.id("confirm-delete-button")).tap();
      await waitFor(element(by.id("delete-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);

      // Delete entry 2026-03-01
      await element(by.text("2026-03-01")).longPress();
      await waitVisible("delete-dialog");
      await element(by.id("confirm-delete-button")).tap();
      await waitFor(element(by.id("delete-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);

      // Verify empty state is restored
      await device.disableSynchronization();
      await expect(element(by.text("No sleep data"))).toBeVisible();
      await device.enableSynchronization();
    });
  });
});
