import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";

describe("Timer", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
    await navigateToTab("Timer");
    await waitVisible("timer-screen");
  });

  describe("Countdown", () => {
    afterAll(async () => {
      await device.enableSynchronization();
    });

    it("shows empty state", async () => {
      await expect(element(by.id("no-timers-text"))).toBeVisible();
    });

    it("creates timer via numpad input", async () => {
      // Enter 1m 30s (000130)
      await element(by.id("numpad-1")).tap();
      await element(by.id("numpad-3")).tap();
      await element(by.id("numpad-0")).tap();

      // Disable sync before starting timer (100ms setInterval blocks Espresso idle)
      await device.disableSynchronization();
      await element(by.id("numpad-start")).tap();

      // Timer card should appear with label "Timer 1"
      await waitFor(element(by.text("Timer 1")))
        .toBeVisible()
        .withTimeout(5000);

      // Empty state should be gone
      await expect(element(by.id("no-timers-text"))).not.toBeVisible();
    });

    it("pauses running timer", async () => {
      await element(by.label("pause timer")).tap();
      await device.enableSynchronization();

      // Resume button should appear
      await waitFor(element(by.label("resume timer")))
        .toBeVisible()
        .withTimeout(3000);
    });

    it("resumes paused timer", async () => {
      await device.disableSynchronization();
      await element(by.label("resume timer")).tap();

      // Pause button should appear again
      await waitFor(element(by.label("pause timer")))
        .toBeVisible()
        .withTimeout(3000);
    });

    it("resets timer", async () => {
      // Pause first
      await element(by.label("pause timer")).tap();
      await device.enableSynchronization();
      await waitFor(element(by.label("resume timer")))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.label("reset timer")).tap();

      // Timer should still exist with resume button
      await waitFor(element(by.label("resume timer")))
        .toBeVisible()
        .withTimeout(3000);
    });

    it("deletes timer", async () => {
      await element(by.label("delete timer")).tap();

      // Empty state should return
      await waitFor(element(by.id("no-timers-text")))
        .toBeVisible()
        .withTimeout(5000);
    });

    it("creates timer via preset button", async () => {
      await device.disableSynchronization();
      await element(by.id("preset-1")).tap();

      // Timer should appear
      await waitFor(element(by.text("Timer 2")))
        .toBeVisible()
        .withTimeout(5000);
    });

    it("uses numpad backspace", async () => {
      // Delete the preset timer first
      // Pause it first
      await element(by.label("pause timer")).tap();
      await device.enableSynchronization();
      await waitFor(element(by.label("delete timer")))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.label("delete timer")).tap();
      await waitFor(element(by.id("no-timers-text")))
        .toBeVisible()
        .withTimeout(5000);

      // Type digits and use backspace
      await element(by.id("numpad-5")).tap();
      await element(by.id("numpad-0")).tap();
      await element(by.id("numpad-0")).tap();
      await element(by.id("numpad-backspace")).tap();

      // Start with remaining digits (50 → 50s)
      await device.disableSynchronization();
      await element(by.id("numpad-start")).tap();

      await waitFor(element(by.text("Timer 3")))
        .toBeVisible()
        .withTimeout(5000);

      // Cleanup
      await element(by.label("pause timer")).tap();
      await device.enableSynchronization();
      await waitFor(element(by.label("delete timer")))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.label("delete timer")).tap();
      await waitFor(element(by.id("no-timers-text")))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe("Stopwatch", () => {
    beforeAll(async () => {
      // Switch to stopwatch tab
      await element(by.text("Stopwatch")).tap();
      await waitVisible("stopwatch-display");
    });

    it("shows initial state", async () => {
      await expect(element(by.id("stopwatch-display"))).toBeVisible();
      await expect(element(by.id("stopwatch-start"))).toBeVisible();
    });

    it("starts stopwatch", async () => {
      await element(by.id("stopwatch-start")).tap();

      // Pause and lap buttons should appear
      await waitFor(element(by.id("stopwatch-pause")))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id("stopwatch-lap"))).toBeVisible();
    });

    it("records lap", async () => {
      await element(by.id("stopwatch-lap")).tap();

      // Lap 1 should appear
      await waitFor(element(by.text("Lap 1")))
        .toBeVisible()
        .withTimeout(3000);
    });

    it("pauses stopwatch", async () => {
      await element(by.id("stopwatch-pause")).tap();

      // Resume and reset buttons should appear
      await waitFor(element(by.id("stopwatch-resume")))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id("stopwatch-reset"))).toBeVisible();
    });

    it("resumes stopwatch", async () => {
      await element(by.id("stopwatch-resume")).tap();

      // Pause button should appear again
      await waitFor(element(by.id("stopwatch-pause")))
        .toBeVisible()
        .withTimeout(3000);
    });

    it("resets stopwatch", async () => {
      // Pause first
      await element(by.id("stopwatch-pause")).tap();
      await waitFor(element(by.id("stopwatch-reset")))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id("stopwatch-reset")).tap();

      // Start button should reappear
      await waitFor(element(by.id("stopwatch-start")))
        .toBeVisible()
        .withTimeout(3000);
    });
  });
});
