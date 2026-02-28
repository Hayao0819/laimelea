import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { IconButton } from "react-native-paper";
import { Text } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { format } from "date-fns";
import { useCurrentTime } from "../../../hooks/useCurrentTime";
import { useFullscreen } from "../../../hooks/useFullscreen";
import { formatCustomTime } from "../../../core/time/formatting";
import { settingsAtom } from "../../../atoms/settingsAtoms";

export function DeskClockScreen() {
  const navigation = useNavigation();
  const { realTimeMs, customTime } = useCurrentTime();
  const settings = useAtomValue(settingsAtom);
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

  useFullscreen();

  const customFormatted = formatCustomTime(customTime);
  const realFormatted = format(
    new Date(realTimeMs),
    settings.timeFormat === "12h" ? "hh:mm:ss a" : "HH:mm:ss",
  );

  const primaryText =
    settings.primaryTimeDisplay === "custom" ? customFormatted : realFormatted;
  const secondaryText =
    settings.primaryTimeDisplay === "custom" ? realFormatted : customFormatted;

  const isLandscape = width > height;
  const primaryFontSize = isLandscape
    ? Math.min(width * 0.15, height * 0.4)
    : Math.min(width * 0.18, height * 0.12);
  const secondaryFontSize = primaryFontSize * 0.35;

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container} testID="desk-clock-screen">
      <StatusBar hidden animated />
      <IconButton
        icon="close"
        iconColor="rgba(255,255,255,0.3)"
        size={24}
        onPress={handleClose}
        style={styles.closeButton}
        accessibilityLabel={t("clock.exitDeskClock")}
        testID="desk-clock-close"
      />
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
    top: 8,
    right: 8,
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
    marginTop: 8,
  },
});
