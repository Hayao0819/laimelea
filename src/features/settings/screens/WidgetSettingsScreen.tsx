import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { List, Switch, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { DEFAULT_WIDGET_SETTINGS } from "../../../models/Settings";
import type { WidgetSettings } from "../../../models/Settings";

export function WidgetSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateWidgetSettings } = useSettingsUpdate();

  const widgetSettings = settings.widgetSettings ?? DEFAULT_WIDGET_SETTINGS;

  const isValidHex = useCallback((value: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  }, []);

  const handleColorBlur = useCallback(
    (field: keyof WidgetSettings, value: string) => {
      if (!isValidHex(value)) {
        updateWidgetSettings({
          [field]: DEFAULT_WIDGET_SETTINGS[field],
        });
      }
    },
    [isValidHex, updateWidgetSettings],
  );

  const handleOpacityChange = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (isNaN(num)) {
        updateWidgetSettings({ opacity: 0 });
        return;
      }
      const clamped = Math.max(0, Math.min(100, num));
      updateWidgetSettings({ opacity: clamped });
    },
    [updateWidgetSettings],
  );

  const renderBorderRadiusSwitch = useCallback(
    () => (
      <Switch
        value={widgetSettings.borderRadius > 0}
        onValueChange={(v) =>
          updateWidgetSettings({ borderRadius: v ? 16 : 0 })
        }
        testID="widget-border-radius-switch"
      />
    ),
    [widgetSettings.borderRadius, updateWidgetSettings],
  );

  const renderShowRealTimeSwitch = useCallback(
    () => (
      <Switch
        value={widgetSettings.showRealTime}
        onValueChange={(v) => updateWidgetSettings({ showRealTime: v })}
        testID="widget-show-real-time-switch"
      />
    ),
    [widgetSettings.showRealTime, updateWidgetSettings],
  );

  const renderShowNextAlarmSwitch = useCallback(
    () => (
      <Switch
        value={widgetSettings.showNextAlarm}
        onValueChange={(v) => updateWidgetSettings({ showNextAlarm: v })}
        testID="widget-show-next-alarm-switch"
      />
    ),
    [widgetSettings.showNextAlarm, updateWidgetSettings],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      testID="widget-settings-screen"
    >
      <List.Section>
        <List.Subheader>{t("settings.widget")}</List.Subheader>
        <View style={styles.colorRow}>
          <View
            style={[
              styles.colorPreview,
              { backgroundColor: widgetSettings.backgroundColor },
            ]}
            testID="widget-bg-color-preview"
          />
          <TextInput
            label={t("settings.widgetBackgroundColor")}
            value={widgetSettings.backgroundColor}
            onChangeText={(text) =>
              updateWidgetSettings({ backgroundColor: text })
            }
            onBlur={() =>
              handleColorBlur("backgroundColor", widgetSettings.backgroundColor)
            }
            style={styles.colorInput}
            mode="outlined"
            testID="widget-bg-color-input"
          />
        </View>
        <View style={styles.colorRow}>
          <View
            style={[
              styles.colorPreview,
              { backgroundColor: widgetSettings.textColor },
            ]}
            testID="widget-text-color-preview"
          />
          <TextInput
            label={t("settings.widgetTextColor")}
            value={widgetSettings.textColor}
            onChangeText={(text) => updateWidgetSettings({ textColor: text })}
            onBlur={() =>
              handleColorBlur("textColor", widgetSettings.textColor)
            }
            style={styles.colorInput}
            mode="outlined"
            testID="widget-text-color-input"
          />
        </View>
        <View style={styles.colorRow}>
          <View
            style={[
              styles.colorPreview,
              { backgroundColor: widgetSettings.secondaryTextColor },
            ]}
            testID="widget-secondary-color-preview"
          />
          <TextInput
            label={t("settings.widgetSecondaryTextColor")}
            value={widgetSettings.secondaryTextColor}
            onChangeText={(text) =>
              updateWidgetSettings({ secondaryTextColor: text })
            }
            onBlur={() =>
              handleColorBlur(
                "secondaryTextColor",
                widgetSettings.secondaryTextColor,
              )
            }
            style={styles.colorInput}
            mode="outlined"
            testID="widget-secondary-color-input"
          />
        </View>
        <View style={styles.colorRow}>
          <View
            style={[
              styles.colorPreview,
              { backgroundColor: widgetSettings.accentColor },
            ]}
            testID="widget-accent-color-preview"
          />
          <TextInput
            label={t("settings.widgetAccentColor")}
            value={widgetSettings.accentColor}
            onChangeText={(text) => updateWidgetSettings({ accentColor: text })}
            onBlur={() =>
              handleColorBlur("accentColor", widgetSettings.accentColor)
            }
            style={styles.colorInput}
            mode="outlined"
            testID="widget-accent-color-input"
          />
        </View>
        <View style={styles.colorRow}>
          <TextInput
            label={t("settings.widgetOpacity")}
            value={String(widgetSettings.opacity)}
            onChangeText={handleOpacityChange}
            keyboardType="numeric"
            style={styles.colorInput}
            mode="outlined"
            testID="widget-opacity-input"
          />
        </View>
        <List.Item
          title={t("settings.widgetBorderRadius")}
          right={renderBorderRadiusSwitch}
          testID="widget-border-radius-item"
        />
        <List.Item
          title={t("settings.widgetShowRealTime")}
          right={renderShowRealTimeSwitch}
          testID="widget-show-real-time-item"
        />
        <List.Item
          title={t("settings.widgetShowNextAlarm")}
          right={renderShowNextAlarmSwitch}
          testID="widget-show-next-alarm-item"
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: "#555",
  },
  colorInput: {
    flex: 1,
  },
});
