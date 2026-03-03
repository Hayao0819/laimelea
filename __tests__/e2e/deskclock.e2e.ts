import { by, element, expect } from "detox";

import { completeSetup, launchAppFresh, waitVisible } from "./utils/helpers";

describe("Desk Clock Screen", () => {
  beforeAll(async () => {
    await launchAppFresh();
    await completeSetup();
  });

  it("navigates to desk clock from header button", async () => {
    await waitVisible("clock-screen");
    await element(by.label("Desk clock")).tap();
    await waitVisible("desk-clock-screen");
  });

  it("displays full-screen desk clock with close button", async () => {
    await expect(element(by.id("desk-clock-screen"))).toBeVisible();
    await expect(element(by.id("desk-clock-close"))).toBeVisible();
  });

  it("shows exit desk clock accessibility label", async () => {
    await expect(element(by.label("Exit desk clock"))).toBeVisible();
  });

  it("returns to clock screen when close button is tapped", async () => {
    await element(by.id("desk-clock-close")).tap();
    await waitVisible("clock-screen");
    await expect(element(by.id("clock-screen"))).toBeVisible();
  });
});
