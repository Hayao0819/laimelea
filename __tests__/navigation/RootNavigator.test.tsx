import { act, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import { settingsAtom } from "../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";

// Suppress act() warnings from Jotai's internal async storage resolution
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) {
      return;
    }
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

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
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

// Collected screen names from the last MockNavigator render.
let registeredScreenNames: string[] = [];

// Mock @react-navigation/native-stack to provide a minimal navigator
// that renders the first matching Screen's component.
jest.mock("@react-navigation/native-stack", () => {
  const ReactLib = require("react");
  const { View } = require("react-native");

  function MockScreen(_props: Record<string, unknown>) {
    return null;
  }

  interface MockScreenProps {
    name: string;
    component?: React.ComponentType;
    getComponent?: () => React.ComponentType;
  }

  function MockNavigator({ children }: { children: React.ReactNode }) {
    const screens: MockScreenProps[] = [];
    ReactLib.Children.forEach(children, (child: unknown) => {
      const el = child as { type?: unknown; props?: unknown };
      if (el && el.type === MockScreen) {
        screens.push(el.props as MockScreenProps);
      }
    });
    ReactLib.Children.forEach(children, (child: unknown) => {
      const el = child as { type?: unknown; props?: unknown };
      if (el && el.type === ReactLib.Fragment) {
        const fragmentProps = el.props as { children?: React.ReactNode };
        ReactLib.Children.forEach(
          fragmentProps.children,
          (fragmentChild: unknown) => {
            const fc = fragmentChild as { type?: unknown; props?: unknown };
            if (fc && fc.type === MockScreen) {
              screens.push(fc.props as MockScreenProps);
            }
          },
        );
      }
    });

    registeredScreenNames = screens.map((s) => s.name);

    if (screens.length === 0) return null;

    const first = screens[0];
    const Component = first.component ?? first.getComponent?.();
    return (
      <View testID="mock-navigator">{Component ? <Component /> : null}</View>
    );
  }

  return {
    createNativeStackNavigator: () => ({
      Navigator: MockNavigator,
      Screen: MockScreen,
    }),
  };
});

// Mock all screen components to avoid deep dependency trees.
jest.mock("../../src/navigation/BottomTabNavigator", () => {
  const { Text } = require("react-native");
  return { BottomTabNavigator: () => <Text>MainTabs</Text> };
});

jest.mock("../../src/features/clock/screens/DeskClockScreen", () => {
  const { Text } = require("react-native");
  return { DeskClockScreen: () => <Text>DeskClock</Text> };
});

jest.mock("../../src/features/settings/screens/SettingsScreen", () => {
  const { Text } = require("react-native");
  return { SettingsScreen: () => <Text>Settings</Text> };
});

jest.mock("../../src/features/settings/screens/CycleConfigScreen", () => {
  const { Text } = require("react-native");
  return { CycleConfigScreen: () => <Text>CycleConfig</Text> };
});

jest.mock("../../src/features/settings/screens/GeneralSettingsScreen", () => {
  const { Text } = require("react-native");
  return { GeneralSettingsScreen: () => <Text>GeneralSettings</Text> };
});

jest.mock("../../src/features/settings/screens/TimezoneSettingsScreen", () => {
  const { Text } = require("react-native");
  return { TimezoneSettingsScreen: () => <Text>TimezoneSettings</Text> };
});

jest.mock("../../src/features/settings/screens/AlarmDefaultsScreen", () => {
  const { Text } = require("react-native");
  return { AlarmDefaultsScreen: () => <Text>AlarmDefaults</Text> };
});

jest.mock("../../src/features/settings/screens/CalendarSettingsScreen", () => {
  const { Text } = require("react-native");
  return { CalendarSettingsScreen: () => <Text>CalendarSettings</Text> };
});

jest.mock("../../src/features/settings/screens/WidgetSettingsScreen", () => {
  const { Text } = require("react-native");
  return { WidgetSettingsScreen: () => <Text>WidgetSettings</Text> };
});

jest.mock("../../src/features/settings/screens/BackupScreen", () => {
  const { Text } = require("react-native");
  return { BackupScreen: () => <Text>Backup</Text> };
});

jest.mock("../../src/features/settings/screens/AboutScreen", () => {
  const { Text } = require("react-native");
  return { AboutScreen: () => <Text>About</Text> };
});

jest.mock("../../src/features/settings/screens/LicensesScreen", () => {
  const { Text } = require("react-native");
  return { LicensesScreen: () => <Text>Licenses</Text> };
});

jest.mock("../../src/features/game2048/screens/Game2048Screen", () => {
  const { Text } = require("react-native");
  return { Game2048Screen: () => <Text>Game2048</Text> };
});

jest.mock("../../src/features/game2048/screens/Game2048SettingsScreen", () => {
  const { Text } = require("react-native");
  return { Game2048SettingsScreen: () => <Text>Game2048Settings</Text> };
});

jest.mock("../../src/features/game2048/screens/Game2048TreeScreen", () => {
  const { Text } = require("react-native");
  return { Game2048TreeScreen: () => <Text>Game2048Tree</Text> };
});

jest.mock("../../src/features/alarm/screens/AlarmEditScreen", () => {
  const { Text } = require("react-native");
  return { AlarmEditScreen: () => <Text>AlarmEdit</Text> };
});

jest.mock("../../src/features/alarm/screens/AlarmFiringScreen", () => {
  const { Text } = require("react-native");
  return { AlarmFiringScreen: () => <Text>AlarmFiring</Text> };
});

jest.mock("../../src/features/alarm/screens/BulkAlarmScreen", () => {
  const { Text } = require("react-native");
  return { BulkAlarmScreen: () => <Text>BulkAlarm</Text> };
});

jest.mock("../../src/features/sleep/screens/ManualSleepEntryScreen", () => {
  const { Text } = require("react-native");
  return { ManualSleepEntryScreen: () => <Text>ManualSleepEntry</Text> };
});

jest.mock("../../src/features/calendar/screens/EventDetailScreen", () => {
  const { Text } = require("react-native");
  return { EventDetailScreen: () => <Text>EventDetail</Text> };
});

jest.mock("../../src/features/setup/screens/SetupScreen", () => {
  const { Text } = require("react-native");
  return { SetupScreen: () => <Text>SetupScreen</Text> };
});

function renderNavigator(store: ReturnType<typeof createStore>) {
  // Import RootNavigator lazily so mocks are in place
  const { RootNavigator } = require("../../src/navigation/RootNavigator");
  return render(
    <JotaiProvider store={store}>
      <RootNavigator />
    </JotaiProvider>,
  );
}

beforeEach(() => {
  registeredScreenNames = [];
});

describe("RootNavigator", () => {
  describe("when settings are still loading", () => {
    it("should render null (no screen)", async () => {
      const store = createStore();
      const { toJSON } = await renderNavigator(store);
      expect(toJSON()).toBeNull();
    });
  });

  describe("when settings are loaded", () => {
    it("should render SetupScreen when setupComplete is false", async () => {
      const store = createStore();
      store.set(settingsAtom, { ...DEFAULT_SETTINGS, setupComplete: false });

      const { getByText } = await renderNavigator(store);
      await act(async () => {});

      expect(getByText("SetupScreen")).toBeTruthy();
    });

    it("should render MainTabs when setupComplete is true", async () => {
      const store = createStore();
      store.set(settingsAtom, { ...DEFAULT_SETTINGS, setupComplete: true });

      const { getByText } = await renderNavigator(store);
      await act(async () => {});

      expect(getByText("MainTabs")).toBeTruthy();
    });

    it("should not render SetupScreen when setupComplete is true", async () => {
      const store = createStore();
      store.set(settingsAtom, { ...DEFAULT_SETTINGS, setupComplete: true });

      const { queryByText } = await renderNavigator(store);
      await act(async () => {});

      expect(queryByText("SetupScreen")).toBeNull();
    });

    it("should not render MainTabs when setupComplete is false", async () => {
      const store = createStore();
      store.set(settingsAtom, { ...DEFAULT_SETTINGS, setupComplete: false });

      const { queryByText } = await renderNavigator(store);
      await act(async () => {});

      expect(queryByText("MainTabs")).toBeNull();
    });

    it("should not have SettingsLegal screen registered", async () => {
      const store = createStore();
      store.set(settingsAtom, { ...DEFAULT_SETTINGS, setupComplete: true });

      await renderNavigator(store);
      await act(async () => {});

      expect(registeredScreenNames).not.toContain("SettingsLegal");
    });
  });
});
