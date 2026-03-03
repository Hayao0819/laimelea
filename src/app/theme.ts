import type { MD3Theme } from "react-native-paper";
import { MD3DarkTheme,MD3LightTheme } from "react-native-paper";

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#3B6898",
    onPrimary: "#FFFFFF",
    primaryContainer: "#D0E4FF",
    onPrimaryContainer: "#001D36",
    secondary: "#735C00",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#FFE088",
    onSecondaryContainer: "#231B00",
    tertiary: "#595992",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E1DFFF",
    onTertiaryContainer: "#15154B",
    background: "#F8FAFF",
    onBackground: "#191C20",
    surface: "#F8FAFF",
    onSurface: "#191C20",
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#9ECAFF",
    onPrimary: "#003258",
    primaryContainer: "#1B4F7E",
    onPrimaryContainer: "#D0E4FF",
    secondary: "#E5C453",
    onSecondary: "#3C2F00",
    secondaryContainer: "#564500",
    onSecondaryContainer: "#FFE088",
    tertiary: "#C3C2FA",
    onTertiary: "#2C2C61",
    tertiaryContainer: "#424278",
    onTertiaryContainer: "#E1DFFF",
    background: "#111418",
    onBackground: "#E1E2E8",
    surface: "#111418",
    onSurface: "#E1E2E8",
  },
};
