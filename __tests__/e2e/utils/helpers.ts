import { by, device, element, waitFor } from "detox";

export async function launchAppFresh() {
  await launchWhenReady(true, "cycle-hours");
}

export async function launchApp() {
  await launchWhenReady(false, "clock-screen");
}

async function launchWhenReady(resetAppState: boolean, readyTestId: string) {
  const launchOptions = {
    newInstance: true,
    ...(resetAppState ? { resetAppState: true } : {}),
    launchArgs: {
      detoxEnableSynchronization: 0,
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await device.launchApp(launchOptions);
      await waitVisible(readyTestId, 30000);
      await device.enableSynchronization();
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await device.terminateApp().catch(() => {});
    }
  }
}

export async function completeSetup(hours = "26", minutes = "0") {
  await waitVisible("cycle-hours");

  await element(by.id("cycle-hours")).replaceText(hours);
  await element(by.id("cycle-minutes")).replaceText(minutes);

  await element(by.text("Use Current Time")).tap();
  await element(by.id("done-button")).tap();
  await waitVisible("clock-screen");
}

export async function navigateToTab(label: string) {
  await element(by.text(label)).atIndex(0).tap();
}

export async function waitVisible(testID: string, timeout = 10000) {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(timeout);
}
