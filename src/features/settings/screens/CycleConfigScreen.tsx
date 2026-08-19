import { format } from "date-fns";
import React, { useCallback, useEffect, useState } from "react";
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

  const cycleLengthMinutes = settings.cycleConfig.cycleLengthMinutes;
  const [hoursText, setHoursText] = useState(() =>
    String(Math.floor(cycleLengthMinutes / 60)),
  );
  const [minutesText, setMinutesText] = useState(() =>
    String(cycleLengthMinutes % 60),
  );

  useEffect(() => {
    setHoursText(String(Math.floor(cycleLengthMinutes / 60)));
    setMinutesText(String(cycleLengthMinutes % 60));
  }, [cycleLengthMinutes]);

  const cycleHours = parseNonNegativeInteger(hoursText);
  const cycleMinutes = parseNonNegativeInteger(minutesText);
  const nextCycleLengthMinutes =
    cycleHours === null || cycleMinutes === null
      ? null
      : cycleHours * 60 + cycleMinutes;
  const isCycleLengthValid =
    cycleMinutes !== null &&
    nextCycleLengthMinutes !== null &&
    Number.isSafeInteger(nextCycleLengthMinutes) &&
    nextCycleLengthMinutes > 0 &&
    cycleMinutes <= 59;

  const handleSaveCycleLength = useCallback(() => {
    if (nextCycleLengthMinutes === null || !isCycleLengthValid) {
      return;
    }
    updateCycleConfig({ cycleLengthMinutes: nextCycleLengthMinutes });
    requestClockWidgetUpdate();
  }, [isCycleLengthValid, nextCycleLengthMinutes, updateCycleConfig]);

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
            value={hoursText}
            onChangeText={setHoursText}
            keyboardType="numeric"
            error={!isCycleLengthValid}
            style={styles.input}
            testID="cycle-hours-input"
          />
          <TextInput
            mode="outlined"
            label={t("settings.cycleLengthMinutes")}
            value={minutesText}
            onChangeText={setMinutesText}
            keyboardType="numeric"
            error={!isCycleLengthValid}
            style={styles.input}
            testID="cycle-minutes-input"
          />
        </View>
        {!isCycleLengthValid && (
          <Text variant="bodySmall" style={styles.error}>
            {t("settings.invalidCycleLength")}
          </Text>
        )}
        <Text variant="bodySmall" style={styles.warning}>
          {t("settings.cycleChangeWarning")}
        </Text>
        <Button
          mode="contained"
          onPress={handleSaveCycleLength}
          disabled={!isCycleLengthValid}
          style={styles.sectionButton}
          testID="save-cycle-length-button"
        >
          {t("common.save")}
        </Button>
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
  error: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xs,
  },
  sectionButton: {
    alignSelf: "flex-start",
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
});

function parseNonNegativeInteger(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}
