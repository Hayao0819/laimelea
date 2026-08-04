import { by, device, element, waitFor } from "detox";

export async function launchAppFresh() {
  await launchWhenReady(true, "cycle-hours");
}

export async function launchApp() {
  await launchWhenReady(false, "clock-screen");
}

async function launchWhenReady(deleteAppData: boolean, readyTestId: string) {
  await device.launchApp({
    newInstance: true,
    ...(deleteAppData ? { delete: true } : {}),
    launchArgs: {
      class: "com.hayao0819.laimelea.DetoxTest",
      detoxEnableSynchronization: 0,
    },
  });
  await waitVisible(readyTestId, 30000);
  await device.enableSynchronization();
}

/**
 * Complete the setup screen by entering cycle length and setting base time.
 */
export async function completeSetup(hours = "26", minutes = "0") {
  await waitVisible("cycle-hours");

  await element(by.id("cycle-hours")).replaceText(hours);
  await element(by.id("cycle-minutes")).replaceText(minutes);

  // Tap "Use Current Time" button
  await element(by.text("Use Current Time")).tap();

  // Tap Done to complete setup
  await element(by.id("done-button")).tap();

  // Wait for main tabs to appear
  await waitVisible("clock-screen");
}

/**
 * Navigate to a tab by tapping the tab label text.
 * MD3 BottomNavigation.Bar renders duplicate label views,
 * so we use atIndex(0) to avoid ambiguous match errors.
 */
export async function navigateToTab(label: string) {
  await element(by.text(label)).atIndex(0).tap();
}

/**
 * Wait for an element to be visible with a configurable timeout.
 */
export async function waitVisible(testID: string, timeout = 10000) {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(timeout);
}
