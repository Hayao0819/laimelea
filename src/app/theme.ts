import { MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#4A6741",
    onPrimary: "#FFFFFF",
    primaryContainer: "#CBE8C1",
    onPrimaryContainer: "#072100",
    secondary: "#526350",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#D5E8CF",
    onSecondaryContainer: "#101F10",
    tertiary: "#39656B",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#BCEBF1",
    onTertiaryContainer: "#001F23",
    background: "#FCFDF6",
    onBackground: "#1A1C19",
    surface: "#FCFDF6",
    onSurface: "#1A1C19",
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#B0CCA6",
    onPrimary: "#1D3613",
    primaryContainer: "#334D2B",
    onPrimaryContainer: "#CBE8C1",
    secondary: "#B9CCB4",
    onSecondary: "#253424",
    secondaryContainer: "#3B4B39",
    onSecondaryContainer: "#D5E8CF",
    tertiary: "#A1CED5",
    onTertiary: "#00363C",
    tertiaryContainer: "#1F4D53",
    onTertiaryContainer: "#BCEBF1",
    background: "#1A1C19",
    onBackground: "#E2E3DC",
    surface: "#1A1C19",
    onSurface: "#E2E3DC",
  },
};
