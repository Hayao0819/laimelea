import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { List, SegmentedButtons, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { resolveLanguage } from "../../../core/i18n";

export function GeneralSettingsScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettingsUpdate();

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      testID="general-settings-screen"
    >
      <List.Section>
        <List.Subheader>{t("settings.general")}</List.Subheader>
        <View style={styles.segmentContainer} testID="primary-display-segment">
          <Text variant="bodyMedium" style={styles.segmentLabel}>
            {t("settings.primaryDisplay")}
          </Text>
          <Text variant="bodySmall" style={styles.segmentDescription}>
            {t("settings.primaryDisplayDescription")}
          </Text>
          <SegmentedButtons<"custom" | "24h">
            value={settings.primaryTimeDisplay}
            onValueChange={(v) => update({ primaryTimeDisplay: v })}
            buttons={[
              { value: "custom", label: t("settings.custom") },
              { value: "24h", label: t("settings.standard24h") },
            ]}
          />
        </View>
        <View style={styles.segmentContainer} testID="language-segment">
          <Text variant="bodyMedium" style={styles.segmentLabel}>
            {t("settings.language")}
          </Text>
          <SegmentedButtons
            value={resolveLanguage(settings.language)}
            onValueChange={(v) => update({ language: v })}
            buttons={[
              { value: "en", label: t("settings.english") },
              { value: "ja", label: t("settings.japanese") },
            ]}
          />
        </View>
        <View style={styles.segmentContainer} testID="theme-segment">
          <Text variant="bodyMedium" style={styles.segmentLabel}>
            {t("settings.theme")}
          </Text>
          <SegmentedButtons<"light" | "dark" | "system">
            value={settings.theme}
            onValueChange={(v) => update({ theme: v })}
            buttons={[
              { value: "light", label: t("settings.themeLight") },
              { value: "dark", label: t("settings.themeDark") },
              { value: "system", label: t("settings.themeSystem") },
            ]}
          />
        </View>
        <View style={styles.segmentContainer} testID="time-format-segment">
          <Text variant="bodyMedium" style={styles.segmentLabel}>
            {t("settings.timeFormat")}
          </Text>
          <SegmentedButtons<"12h" | "24h">
            value={settings.timeFormat}
            onValueChange={(v) => update({ timeFormat: v })}
            buttons={[
              { value: "12h", label: "12h" },
              { value: "24h", label: "24h" },
            ]}
          />
        </View>
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  segmentContainer: {
    paddingHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  segmentLabel: {
    marginBottom: spacing.sm,
  },
  segmentDescription: {
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
});
