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

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => {
    const store = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        store.has(key) ? store.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
  },
}));

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

  it("commits a valid background color on blur", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-bg-color-input");

    await fireEvent.changeText(input, "#FF0000");
    expect(
      (store.get(settingsAtom) as AppSettings).widgetSettings.backgroundColor,
    ).toBe(DEFAULT_WIDGET_SETTINGS.backgroundColor);
    await act(async () => {
      getByTestId("widget-bg-color-input").props.onBlur({});
    });

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

  it("restores the previous custom color after an incomplete edit", async () => {
    const { getByTestId, store } = await renderScreen({
      widgetSettings: {
        ...DEFAULT_WIDGET_SETTINGS,
        backgroundColor: "#123456",
      },
    });

    await fireEvent.changeText(getByTestId("widget-bg-color-input"), "#123");
    await act(async () => {
      getByTestId("widget-bg-color-input").props.onBlur({});
    });

    expect(getByTestId("widget-bg-color-input").props.value).toBe("#123456");
    expect(
      (store.get(settingsAtom) as AppSettings).widgetSettings.backgroundColor,
    ).toBe("#123456");
  });

  it("keeps an active color draft when settings change elsewhere", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-bg-color-input");

    fireEvent(input, "focus");
    fireEvent.changeText(input, "#123");

    await act(async () => {
      const current = store.get(settingsAtom) as AppSettings;
      store.set(settingsAtom, {
        ...current,
        widgetSettings: {
          ...current.widgetSettings,
          backgroundColor: "#ABCDEF",
          textColor: "#010203",
        },
      });
    });

    expect(getByTestId("widget-bg-color-input").props.value).toBe("#123");
    expect(getByTestId("widget-text-color-input").props.value).toBe("#010203");
  });

  it("commits valid opacity on blur and rejects out-of-range input", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-opacity-input");

    await fireEvent.changeText(input, "50");
    expect(
      (store.get(settingsAtom) as AppSettings).widgetSettings.opacity,
    ).toBe(DEFAULT_WIDGET_SETTINGS.opacity);
    await act(async () => {
      getByTestId("widget-opacity-input").props.onBlur({});
    });

    await waitFor(() => {
      const updated = store.get(settingsAtom) as AppSettings;
      expect(updated.widgetSettings.opacity).toBe(50);
    });

    await fireEvent.changeText(getByTestId("widget-opacity-input"), "150");
    await act(async () => {
      getByTestId("widget-opacity-input").props.onBlur({});
    });

    expect(
      (store.get(settingsAtom) as AppSettings).widgetSettings.opacity,
    ).toBe(50);
    expect(getByTestId("widget-opacity-input").props.value).toBe("50");
  });

  it("preserves opacity when the input is empty or invalid", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-opacity-input");

    await fireEvent.changeText(input, "");
    expect(
      (store.get(settingsAtom) as AppSettings).widgetSettings.opacity,
    ).toBe(DEFAULT_WIDGET_SETTINGS.opacity);
    await act(async () => {
      getByTestId("widget-opacity-input").props.onBlur({});
    });

    expect(getByTestId("widget-opacity-input").props.value).toBe(
      String(DEFAULT_WIDGET_SETTINGS.opacity),
    );
  });

  it("keeps an active opacity draft when settings change elsewhere", async () => {
    const { getByTestId, store } = await renderScreen();
    const input = getByTestId("widget-opacity-input");

    fireEvent(input, "focus");
    fireEvent.changeText(input, "5");

    await act(async () => {
      const current = store.get(settingsAtom) as AppSettings;
      store.set(settingsAtom, {
        ...current,
        widgetSettings: {
          ...current.widgetSettings,
          opacity: 90,
        },
      });
    });

    expect(getByTestId("widget-opacity-input").props.value).toBe("5");
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

    await fireEvent.changeText(getByTestId("widget-bg-color-input"), "#FF0000");
    expect(mockWidgetUpdate).not.toHaveBeenCalled();
    await act(async () => {
      getByTestId("widget-bg-color-input").props.onBlur({});
    });

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

    await fireEvent.changeText(getByTestId("widget-opacity-input"), "50");
    expect(mockWidgetUpdate).not.toHaveBeenCalled();
    await act(async () => {
      getByTestId("widget-opacity-input").props.onBlur({});
    });

    await waitFor(() => {
      expect(mockWidgetUpdate).toHaveBeenCalled();
    });
  });
});
