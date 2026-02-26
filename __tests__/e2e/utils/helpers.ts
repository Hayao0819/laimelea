import { device, element, by, waitFor } from "detox";

/**
 * Launch app with a fresh state (clear AsyncStorage).
 */
export async function launchAppFresh() {
  await device.launchApp({ newInstance: true, delete: true });
}

/**
 * Launch app preserving existing state.
 */
export async function launchApp() {
  await device.launchApp({ newInstance: true });
}

/**
 * Complete the setup screen by entering cycle length and setting base time.
 */
export async function completeSetup(hours = "26", minutes = "0") {
  await waitVisible("cycle-hours");

  await element(by.id("cycle-hours")).clearText();
  await element(by.id("cycle-hours")).typeText(hours);

  await element(by.id("cycle-minutes")).clearText();
  await element(by.id("cycle-minutes")).typeText(minutes);

  // Dismiss keyboard
  await device.pressBack();

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
