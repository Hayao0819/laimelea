import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { WidgetSettingsScreen } from "../../../../src/features/settings/screens/WidgetSettingsScreen";
import type { AppSettings } from "../../../../src/models/Settings";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

const mockWidgetUpdate = jest.fn();
jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: (...args: unknown[]) => mockWidgetUpdate(...args),
}));

async function renderScreen(settingsOverride?: Partial<AppSettings>) {
  const store = createStore();
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  store.set(settingsAtom, settings);
  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <WidgetSettingsScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

describe("WidgetSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders widget settings screen", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("widget-settings-screen")).toBeTruthy();
  });

  it("displays default widget colors", async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId("widget-bg-color-input").props.value).toBe(
      DEFAULT_WIDGET_SETTINGS.backgroundColor,
    );
    expect(getByTestId("widget-text-color-input").props.value).toBe(
      DEFAULT_WIDGET_SETTINGS.textColor,
    );
    expect(getByTestId("widget-secondary-color-input").props.value).toBe(
      DEFAULT_WIDGET_SETTINGS.secondaryTextColor,
    );
    expect(getByTestId("widget-accent-color-input").props.value).toBe(
      DEFAULT_WIDGET_SETTINGS.accentColor,
    );
  });

  it("updates background color on input", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-bg-color-input");

    await fireEvent.changeText(input, "#FF0000");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.backgroundColor).toBe("#FF0000");
    });
  });

  it("resets invalid hex color to default on blur", async () => {
    // Start with an invalid background color already set
    const { getByTestId, store } = await renderScreen({
      widgetSettings: {
        ...DEFAULT_WIDGET_SETTINGS,
        backgroundColor: "invalid",
      },
    });

    // Confirm the invalid color is displayed
    expect(getByTestId("widget-bg-color-input").props.value).toBe("invalid");

    // Blur should trigger validation and reset to default
    await act(async () => {
      getByTestId("widget-bg-color-input").props.onBlur({});
    });

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.backgroundColor).toBe(
        DEFAULT_WIDGET_SETTINGS.backgroundColor,
      );
    });
  });

  it("validates hex format correctly", async () => {
    // Valid hex "#123ABC" should remain after blur — the color stays unchanged
    const { getByTestId: getValid } = await renderScreen({
      widgetSettings: {
        ...DEFAULT_WIDGET_SETTINGS,
        backgroundColor: "#123ABC",
      },
    });

    expect(getValid("widget-bg-color-input").props.value).toBe("#123ABC");

    await act(async () => {
      getValid("widget-bg-color-input").props.onBlur({});
    });

    // Value unchanged because "#123ABC" is valid
    expect(getValid("widget-bg-color-input").props.value).toBe("#123ABC");

    // Invalid hex "#GGG" should reset to default after blur
    const { getByTestId: getInvalid, store: invalidStore } = await renderScreen(
      {
        widgetSettings: {
          ...DEFAULT_WIDGET_SETTINGS,
          textColor: "#GGG",
        },
      },
    );

    expect(getInvalid("widget-text-color-input").props.value).toBe("#GGG");

    await act(async () => {
      getInvalid("widget-text-color-input").props.onBlur({});
    });

    await waitFor(() => {
      const updated = invalidStore.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.textColor).toBe(
        DEFAULT_WIDGET_SETTINGS.textColor,
      );
    });
  });

  it("updates opacity and clamps to 0-100", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-opacity-input");

    // "150" should clamp to 100
    await fireEvent.changeText(input, "150");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.opacity).toBe(100);
    });

    // "-5" should clamp to 0
    await fireEvent.changeText(input, "-5");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.opacity).toBe(0);
    });
  });

  it("handles NaN opacity input", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-opacity-input");

    await fireEvent.changeText(input, "abc");

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.opacity).toBe(0);
    });
  });

  it("toggles border radius switch", async () => {
    const { getByTestId, store } = await renderScreen();
    const toggle = getByTestId("widget-border-radius-switch");

    // Default borderRadius is 16 (on), toggle off -> 0
    await fireEvent(toggle, "valueChange", false);

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.borderRadius).toBe(0);
    });

    // Toggle on -> 16
    await fireEvent(toggle, "valueChange", true);

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.borderRadius).toBe(16);
    });
  });

  it("toggles show real time switch", async () => {
    const { getByTestId, store } = await renderScreen();
    const toggle = getByTestId("widget-show-real-time-switch");

    // Default showRealTime is true, toggle off
    await fireEvent(toggle, "valueChange", false);

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.showRealTime).toBe(false);
    });

    // Toggle back on
    await fireEvent(toggle, "valueChange", true);

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.showRealTime).toBe(true);
    });
  });

  it("toggles show next alarm switch", async () => {
    const { getByTestId, store } = await renderScreen();
    const toggle = getByTestId("widget-show-next-alarm-switch");

    // Default showNextAlarm is true, toggle off
    await fireEvent(toggle, "valueChange", false);

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.showNextAlarm).toBe(false);
    });

    // Toggle back on
    await fireEvent(toggle, "valueChange", true);

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.showNextAlarm).toBe(true);
    });
  });

  it("calls requestClockWidgetUpdate on changes", async () => {
    const { getByTestId } = await renderScreen();

    // Change a color
    await fireEvent.changeText(getByTestId("widget-bg-color-input"), "#FF0000");

    await waitFor(() => {
      expect(mockWidgetUpdate).toHaveBeenCalled();
    });

    mockWidgetUpdate.mockClear();

    // Toggle a switch
    await fireEvent(
      getByTestId("widget-show-real-time-switch"),
      "valueChange",
      false,
    );

    await waitFor(() => {
      expect(mockWidgetUpdate).toHaveBeenCalled();
    });

    mockWidgetUpdate.mockClear();

    // Change opacity
    await fireEvent.changeText(getByTestId("widget-opacity-input"), "50");

    await waitFor(() => {
      expect(mockWidgetUpdate).toHaveBeenCalled();
    });
  });
});
