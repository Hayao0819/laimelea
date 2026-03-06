import { by, device, element, expect, waitFor } from "detox";

import {
  completeSetup,
  launchAppFresh,
  waitVisible,
} from "./utils/helpers";

describe("Game 2048", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
  });

  describe("Easter Egg Unlock", () => {
    it("navigates to About screen", async () => {
      await element(by.id("appbar-settings-button")).tap();
      await waitVisible("settings-screen");

      await element(by.id("settings-screen")).scrollTo("bottom");
      await element(by.id("settings-about-item")).tap();
      await waitVisible("about-screen");
    });

    it("shows hint after 5 taps on version", async () => {
      // Tap version item 5 times rapidly (timer resets after 2s)
      for (let i = 0; i < 5; i++) {
        await element(by.id("version-item")).tap();
      }

      // Snackbar should appear with remaining tap count (2 more)
      await waitFor(element(by.id("about-snackbar")))
        .toBeVisible()
        .withTimeout(5000);
    });

    it("unlocks game after 7 taps on version", async () => {
      // Tap 2 more times (total 7) to trigger unlock
      await element(by.id("version-item")).tap();
      await element(by.id("version-item")).tap();

      // Should auto-navigate to Game2048Screen
      await waitVisible("game-2048-screen");
    });
  });

  describe("Game Screen", () => {
    it("shows game board", async () => {
      await waitVisible("game-board");
    });

    it("shows game header with score", async () => {
      await waitVisible("game-header");
    });

    it("shows new game and undo buttons", async () => {
      await waitVisible("new-game-button");
      await waitVisible("undo-button");
    });

    it("performs swipe to move tiles", async () => {
      await element(by.id("game-board")).swipe("left");
      await element(by.id("game-board")).swipe("up");
      await element(by.id("game-board")).swipe("right");
      await element(by.id("game-board")).swipe("down");
    });

    it("starts new game", async () => {
      await element(by.id("new-game-button")).tap();
      await waitVisible("game-board");
    });
  });

  describe("Settings Screen", () => {
    it("navigates to game settings", async () => {
      await element(by.id("settings-button")).tap();
      await waitVisible("game2048-settings-screen");
    });

    it("shows lucky mode item", async () => {
      await waitVisible("lucky-mode-item");
    });

    it("toggles lucky mode", async () => {
      await element(by.id("lucky-mode-switch")).tap();
      await element(by.id("lucky-mode-switch")).tap();
    });

    it("returns to game screen", async () => {
      await device.pressBack();
      await waitVisible("game-2048-screen");
    });
  });

  describe("Tree Screen", () => {
    it("navigates to tree screen", async () => {
      await element(by.id("tree-button")).tap();
      await waitVisible("game-2048-tree-screen");
    });

    it("returns to game screen", async () => {
      await device.pressBack();
      await waitVisible("game-2048-screen");
    });
  });

  describe("Save/Load", () => {
    it("opens save slot dialog", async () => {
      await element(by.id("open-saves-button")).tap();
      await waitVisible("save-slot-dialog");
    });

    it("shows save current button", async () => {
      await expect(element(by.id("save-current-button"))).toBeVisible();
    });

    it("closes save slot dialog", async () => {
      await device.pressBack();

      await waitFor(element(by.id("save-slot-dialog")))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });
});
