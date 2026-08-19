import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { List, Switch, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import { DEFAULT_WIDGET_SETTINGS } from "../../../models/Settings";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";

type ColorField =
  | "backgroundColor"
  | "textColor"
  | "secondaryTextColor"
  | "accentColor";

export function WidgetSettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateWidgetSettings } = useSettingsUpdate();
  const insets = useSafeAreaInsets();

  const widgetSettings = settings.widgetSettings ?? DEFAULT_WIDGET_SETTINGS;
  const [colorDrafts, setColorDrafts] = useState<Record<ColorField, string>>(
    () => ({
      backgroundColor: widgetSettings.backgroundColor,
      textColor: widgetSettings.textColor,
      secondaryTextColor: widgetSettings.secondaryTextColor,
      accentColor: widgetSettings.accentColor,
    }),
  );
  const [opacityDraft, setOpacityDraft] = useState(() =>
    String(widgetSettings.opacity),
  );
  const editingColors = useRef(new Set<ColorField>());
  const editingOpacity = useRef(false);

  useEffect(() => {
    setColorDrafts((current) => ({
      backgroundColor: editingColors.current.has("backgroundColor")
        ? current.backgroundColor
        : widgetSettings.backgroundColor,
      textColor: editingColors.current.has("textColor")
        ? current.textColor
        : widgetSettings.textColor,
      secondaryTextColor: editingColors.current.has("secondaryTextColor")
        ? current.secondaryTextColor
        : widgetSettings.secondaryTextColor,
      accentColor: editingColors.current.has("accentColor")
        ? current.accentColor
        : widgetSettings.accentColor,
    }));
  }, [
    widgetSettings.accentColor,
    widgetSettings.backgroundColor,
    widgetSettings.secondaryTextColor,
    widgetSettings.textColor,
  ]);

  useEffect(() => {
    if (!editingOpacity.current) {
      setOpacityDraft(String(widgetSettings.opacity));
    }
  }, [widgetSettings.opacity]);

  const isValidHex = useCallback((value: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  }, []);

  const handleColorBlur = useCallback(
    (field: ColorField) => {
      editingColors.current.delete(field);
      const value = colorDrafts[field].trim();
      if (isValidHex(value)) {
        if (value !== widgetSettings[field]) {
          updateWidgetSettings({ [field]: value });
        }
        setColorDrafts((current) => ({ ...current, [field]: value }));
        return;
      }
      const storedValue = widgetSettings[field];
      const fallback = isValidHex(storedValue)
        ? storedValue
        : DEFAULT_WIDGET_SETTINGS[field];
      setColorDrafts((current) => ({ ...current, [field]: fallback }));
      if (fallback !== storedValue) updateWidgetSettings({ [field]: fallback });
    },
    [colorDrafts, isValidHex, updateWidgetSettings, widgetSettings],
  );

  const handleOpacityBlur = useCallback(() => {
    editingOpacity.current = false;
    const value = Number(opacityDraft);
    if (
      opacityDraft.trim() !== "" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 100
    ) {
      if (value !== widgetSettings.opacity) {
        updateWidgetSettings({ opacity: value });
      }
      setOpacityDraft(String(value));
      return;
    }
    setOpacityDraft(String(widgetSettings.opacity));
  }, [opacityDraft, updateWidgetSettings, widgetSettings.opacity]);

  const updateColorDraft = useCallback((field: ColorField, value: string) => {
    setColorDrafts((current) => ({ ...current, [field]: value }));
  }, []);

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
      contentContainerStyle={[
        styles.scroll,
        {
          paddingBottom: spacing.xl + insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
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
            value={colorDrafts.backgroundColor}
            onFocus={() => editingColors.current.add("backgroundColor")}
            onChangeText={(text) => updateColorDraft("backgroundColor", text)}
            onBlur={() => handleColorBlur("backgroundColor")}
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
            value={colorDrafts.textColor}
            onFocus={() => editingColors.current.add("textColor")}
            onChangeText={(text) => updateColorDraft("textColor", text)}
            onBlur={() => handleColorBlur("textColor")}
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
            value={colorDrafts.secondaryTextColor}
            onFocus={() => editingColors.current.add("secondaryTextColor")}
            onChangeText={(text) =>
              updateColorDraft("secondaryTextColor", text)
            }
            onBlur={() => handleColorBlur("secondaryTextColor")}
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
            value={colorDrafts.accentColor}
            onFocus={() => editingColors.current.add("accentColor")}
            onChangeText={(text) => updateColorDraft("accentColor", text)}
            onBlur={() => handleColorBlur("accentColor")}
            style={styles.colorInput}
            mode="outlined"
            testID="widget-accent-color-input"
          />
        </View>
        <View style={styles.colorRow}>
          <TextInput
            label={t("settings.widgetOpacity")}
            value={opacityDraft}
            onFocus={() => {
              editingOpacity.current = true;
            }}
            onChangeText={setOpacityDraft}
            onBlur={handleOpacityBlur}
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
