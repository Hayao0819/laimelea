import React from "react";
import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { format } from "date-fns";
import { ja } from "date-fns/locale/ja";
import { enUS } from "date-fns/locale/en-US";
import { useTranslation } from "react-i18next";

interface Props {
  realTimeMs: number;
}

export function CustomDayIndicator({ realTimeMs }: Props) {
  const { i18n } = useTranslation();
  const isJa = i18n.language === "ja";
  const locale = isJa ? ja : enUS;
  const pattern = isJa ? "M月d日 (EEE)" : "M/d (EEE)";
  const dateText = format(new Date(realTimeMs), pattern, { locale });

  return (
    <Text
      variant="titleLarge"
      style={styles.text}
      testID="custom-day-indicator"
      accessibilityRole="header"
    >
      {dateText}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: "center",
  },
});
