import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

const mockRootNavigate = jest.fn();
const mockTabDispatch = jest.fn();
const mockTabEmit = jest.fn(() => ({ defaultPrevented: false }));
const mockPreventDefaults: jest.Mock[] = [];
let mockRegisteredScreenNames: string[] = [];

jest.mock("@react-native-vector-icons/material-design-icons/static", () => ({
  MaterialDesignIcons: () => null,
}));

jest.mock("@react-navigation/native", () => ({
  CommonActions: {
    navigate: (name: string, params?: object) => ({
      type: "NAVIGATE",
      payload: { name, params },
    }),
  },
  useNavigation: () => ({ navigate: mockRootNavigate }),
}));

jest.mock("@react-navigation/bottom-tabs", () => {
  const ReactLib = require("react");
  const { View } = require("react-native");

  function Screen() {
    return null;
  }

  function Navigator({
    children,
    screenOptions,
    tabBar,
  }: {
    children: React.ReactNode;
    screenOptions: {
      header: (props: { options: { title?: string } }) => React.ReactNode;
    };
    tabBar: (props: object) => React.ReactNode;
  }) {
    const screens = ReactLib.Children.toArray(children) as Array<{
      props: { name: string; options: Record<string, unknown> };
    }>;
    mockRegisteredScreenNames = screens.map((screen) => screen.props.name);
    const routes = screens.map((screen, index) => ({
      key: `route-${index}`,
      name: screen.props.name,
      params: undefined,
    }));
    const descriptors = Object.fromEntries(
      screens.map((screen, index) => [
        routes[index].key,
        { options: screen.props.options },
      ]),
    );
    const clockOptions = screens[0].props.options as {
      header: (props: { options: { title?: string } }) => React.ReactNode;
    };

    return ReactLib.createElement(
      View,
      { testID: "bottom-tab-navigator" },
      tabBar({
        navigation: { emit: mockTabEmit, dispatch: mockTabDispatch },
        state: { key: "tabs", index: 0, routes },
        descriptors,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
      screenOptions.header({ options: { title: "Default" } }),
      clockOptions.header({ options: { title: "Clock" } }),
    );
  }

  return {
    createBottomTabNavigator: () => ({ Navigator, Screen }),
  };
});

jest.mock("react-native-paper", () => {
  const ReactLib = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    Appbar: {
      Header: ({ children }: { children: React.ReactNode }) =>
        ReactLib.createElement(View, null, children),
      Content: ({ title }: { title: string }) =>
        ReactLib.createElement(Text, null, title),
      Action: ({
        icon,
        onPress,
        testID,
        accessibilityLabel,
      }: {
        icon: string;
        onPress: () => void;
        testID: string;
        accessibilityLabel?: string;
      }) =>
        ReactLib.createElement(
          Pressable,
          { onPress, testID, accessibilityLabel },
          ReactLib.createElement(Text, null, icon),
        ),
    },
    BottomNavigation: {
      Bar: ({
        navigationState,
        onTabPress,
        renderIcon,
        getLabelText,
      }: {
        navigationState: { routes: Array<{ key: string; name: string }> };
        onTabPress: (args: {
          route: { key: string; name: string };
          preventDefault: () => void;
        }) => void;
        renderIcon: (args: {
          route: { key: string; name: string };
          focused: boolean;
          color: string;
        }) => React.ReactNode;
        getLabelText: (args: {
          route: { key: string; name: string };
        }) => string;
      }) =>
        ReactLib.createElement(
          View,
          { testID: "tab-bar" },
          navigationState.routes.map((route) =>
            ReactLib.createElement(
              Pressable,
              {
                key: route.key,
                testID: `tab-${route.name}`,
                onPress: () => {
                  const preventDefault = jest.fn();
                  mockPreventDefaults.push(preventDefault);
                  onTabPress({ route, preventDefault });
                },
              },
              renderIcon({ route, focused: false, color: "black" }),
              ReactLib.createElement(Text, null, getLabelText({ route })),
            ),
          ),
        ),
    },
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../src/features/alarm/screens/AlarmListScreen", () => ({
  AlarmListScreen: () => null,
}));
jest.mock("../../src/features/calendar/screens/CalendarScreen", () => ({
  CalendarScreen: () => null,
}));
jest.mock("../../src/features/clock/screens/ClockScreen", () => ({
  ClockScreen: () => null,
}));
jest.mock("../../src/features/sleep/screens/SleepLogScreen", () => ({
  SleepLogScreen: () => null,
}));
jest.mock("../../src/features/timer/screens/TimerScreen", () => ({
  TimerScreen: () => null,
}));

import { BottomTabNavigator } from "../../src/navigation/BottomTabNavigator";

describe("BottomTabNavigator", () => {
  beforeEach(() => {
    mockRegisteredScreenNames = [];
    mockPreventDefaults.length = 0;
    jest.clearAllMocks();
    mockTabEmit.mockReturnValue({ defaultPrevented: false });
  });

  it("registers every primary screen", () => {
    const { getByTestId } = render(<BottomTabNavigator />);

    expect(getByTestId("bottom-tab-navigator")).toBeTruthy();
    expect(mockRegisteredScreenNames).toEqual([
      "ClockTab",
      "AlarmTab",
      "CalendarTab",
      "SleepTab",
      "TimerTab",
    ]);
  });

  it("dispatches navigation for an unhandled tab press", () => {
    const { getByTestId } = render(<BottomTabNavigator />);

    fireEvent.press(getByTestId("tab-AlarmTab"));

    expect(mockTabDispatch).toHaveBeenCalledWith({
      type: "NAVIGATE",
      payload: { name: "AlarmTab", params: undefined },
      target: "tabs",
    });
  });

  it("preserves a prevented tab press", () => {
    mockTabEmit.mockReturnValueOnce({ defaultPrevented: true });
    const { getByTestId } = render(<BottomTabNavigator />);

    fireEvent.press(getByTestId("tab-CalendarTab"));

    expect(mockPreventDefaults[0]).toHaveBeenCalledTimes(1);
    expect(mockTabDispatch).not.toHaveBeenCalled();
  });

  it("navigates to settings and desk clock from the headers", () => {
    const { getAllByTestId, getByTestId } = render(<BottomTabNavigator />);

    fireEvent.press(getAllByTestId("appbar-settings-button")[0]);
    fireEvent.press(getByTestId("appbar-desk-clock-button"));

    expect(mockRootNavigate).toHaveBeenCalledWith("Settings");
    expect(mockRootNavigate).toHaveBeenCalledWith("DeskClock");
  });
});
