import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, List, SegmentedButtons, Text } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { resolveLanguage } from "../../../core/i18n";
import type { BatteryOptimizationStatus } from "../hooks/useBatteryOptimization";
import { useBatteryOptimization } from "../hooks/useBatteryOptimization";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";

function batteryIcon(status: BatteryOptimizationStatus): string {
  if (status === null) return "battery-unknown";
  return status ? "battery-check" : "battery-alert";
}

export function GeneralSettingsScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettingsUpdate();
  const { ignored: batteryOptIgnored, requestExclusion } =
    useBatteryOptimization();

  const renderBatteryIcon = useCallback(
    (props: { color: string }) => (
      <List.Icon color={props.color} icon={batteryIcon(batteryOptIgnored)} />
    ),
    [batteryOptIgnored],
  );

  const renderBatteryRight = useCallback(() => {
    if (batteryOptIgnored === true) {
      return <List.Icon icon="check" />;
    }
    if (batteryOptIgnored === false) {
      return (
        <Button
          mode="outlined"
          onPress={requestExclusion}
          testID="battery-optimization-request-button"
        >
          {t("settings.batteryOptimizationRequest")}
        </Button>
      );
    }
    return null;
  }, [batteryOptIgnored, requestExclusion, t]);

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
      <List.Section>
        <List.Subheader>{t("settings.batteryOptimization")}</List.Subheader>
        <List.Item
          title={t("settings.batteryOptimizationTitle")}
          description={
            batteryOptIgnored === null
              ? t("settings.batteryOptimizationChecking")
              : batteryOptIgnored
                ? t("settings.batteryOptimizationDisabled")
                : t("settings.batteryOptimizationEnabled")
          }
          left={renderBatteryIcon}
          right={renderBatteryRight}
          testID="battery-optimization-item"
        />
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
