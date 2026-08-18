import { useNavigation } from "@react-navigation/native";
import { useAtomValue } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StatusBar, StyleSheet, useWindowDimensions, View } from "react-native";
import { IconButton } from "react-native-paper";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { formatCustomTime } from "../../../core/time/formatting";
import { formatDisplayTime } from "../../../core/time/timezone";
import { useCurrentTime } from "../../../hooks/useCurrentTime";
import { useFullscreen } from "../../../hooks/useFullscreen";

export function getDeskClockPrimaryFontSize(width: number, height: number) {
  return width > height
    ? Math.min(width * 0.15, height * 0.4)
    : Math.min(width * 0.18, height * 0.12);
}

export function DeskClockScreen() {
  const navigation = useNavigation();
  const { realTimeMs, customTime } = useCurrentTime();
  const settings = useAtomValue(resolvedSettingsAtom);
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useFullscreen();

  const customFormatted = formatCustomTime(customTime);
  const realFormatted = formatDisplayTime(realTimeMs, settings);

  const primaryText =
    settings.primaryTimeDisplay === "custom" ? customFormatted : realFormatted;
  const secondaryText =
    settings.primaryTimeDisplay === "custom" ? realFormatted : customFormatted;

  const primaryFontSize = getDeskClockPrimaryFontSize(width, height);
  const secondaryFontSize = primaryFontSize * 0.35;

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container} testID="desk-clock-screen">
      <StatusBar hidden animated />
      <View
        style={[
          styles.closeButton,
          { top: insets.top + spacing.sm, right: insets.right + spacing.sm },
        ]}
        testID="desk-clock-close-target"
      >
        <IconButton
          icon="close"
          iconColor="rgba(255,255,255,0.3)"
          size={24}
          onPress={handleClose}
          accessibilityLabel={t("clock.exitDeskClock")}
          testID="desk-clock-close"
        />
      </View>
      <View style={styles.content}>
        <Text
          style={[
            styles.primaryTime,
            { fontSize: primaryFontSize, lineHeight: primaryFontSize * 1.1 },
          ]}
          accessibilityRole="timer"
          accessibilityLabel={primaryText}
        >
          {primaryText}
        </Text>
        <Text
          style={[styles.secondaryTime, { fontSize: secondaryFontSize }]}
          accessibilityLabel={secondaryText}
        >
          {secondaryText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  closeButton: {
    position: "absolute",
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryTime: {
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    fontWeight: "200",
  },
  secondaryTime: {
    color: "rgba(255,255,255,0.5)",
    fontVariant: ["tabular-nums"],
    marginTop: spacing.sm,
  },
});
