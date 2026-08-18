import { format } from "date-fns";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, List, Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";

export function CycleConfigScreen() {
  const { t } = useTranslation();
  const { settings, updateCycleConfig } = useSettingsUpdate();
  const insets = useSafeAreaInsets();

  const cycleHours = Math.floor(settings.cycleConfig.cycleLengthMinutes / 60);
  const cycleMinutes = settings.cycleConfig.cycleLengthMinutes % 60;

  const handleCycleHoursChange = useCallback(
    (text: string) => {
      const h = parseInt(text, 10) || 0;
      updateCycleConfig({ cycleLengthMinutes: h * 60 + cycleMinutes });
      requestClockWidgetUpdate();
    },
    [cycleMinutes, updateCycleConfig],
  );

  const handleCycleMinutesChange = useCallback(
    (text: string) => {
      const m = parseInt(text, 10) || 0;
      updateCycleConfig({ cycleLengthMinutes: cycleHours * 60 + m });
      requestClockWidgetUpdate();
    },
    [cycleHours, updateCycleConfig],
  );

  const handleUseCurrentTime = useCallback(() => {
    updateCycleConfig({ baseTimeMs: Date.now() });
    requestClockWidgetUpdate();
  }, [updateCycleConfig]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        {
          paddingBottom: spacing.xl + insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      testID="cycle-config-screen"
    >
      <List.Section>
        <List.Subheader>{t("settings.cycleConfig")}</List.Subheader>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={t("settings.cycleLengthHours")}
            value={String(cycleHours)}
            onChangeText={handleCycleHoursChange}
            keyboardType="numeric"
            style={styles.input}
            testID="cycle-hours-input"
          />
          <TextInput
            mode="outlined"
            label={t("settings.cycleLengthMinutes")}
            value={String(cycleMinutes)}
            onChangeText={handleCycleMinutesChange}
            keyboardType="numeric"
            style={styles.input}
            testID="cycle-minutes-input"
          />
        </View>
        <Text variant="bodySmall" style={styles.warning}>
          {t("settings.cycleChangeWarning")}
        </Text>
        <List.Item
          title={t("settings.baseTime")}
          description={
            settings.cycleConfig.baseTimeMs > 0
              ? format(
                  new Date(settings.cycleConfig.baseTimeMs),
                  "yyyy-MM-dd HH:mm:ss",
                )
              : t("common.notSet")
          }
          testID="base-time-item"
        />
        <Button
          mode="outlined"
          onPress={handleUseCurrentTime}
          style={styles.sectionButton}
          testID="use-current-time-button"
        >
          {t("settings.useCurrentTime")}
        </Button>
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
  },
  warning: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  sectionButton: {
    alignSelf: "flex-start",
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
});
