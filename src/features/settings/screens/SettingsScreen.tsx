import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, List, useTheme } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { spacing } from "../../../app/spacing";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../models/Settings";
import type { AppSettings } from "../../../models/Settings";

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const rawSettings = useAtomValue(settingsAtom);
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...rawSettings };

  const cycleHours = Math.floor(settings.cycleConfig.cycleLengthMinutes / 60);
  const cycleMinutes = settings.cycleConfig.cycleLengthMinutes % 60;

  const renderChevron = useCallback(
    (props: { color: string; style?: object }) => (
      <List.Icon {...props} icon="chevron-right" />
    ),
    [],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="settings-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <List.Section>
          <List.Subheader>{t("settings.categoryApp")}</List.Subheader>
          <List.Item
            title={t("settings.cycleConfig")}
            description={`${cycleHours}h ${cycleMinutes}m`}
            left={(props) => <List.Icon {...props} icon="clock-edit-outline" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsCycleConfig")}
            testID="settings-cycle-config-item"
          />
          <List.Item
            title={t("settings.general")}
            left={(props) => <List.Icon {...props} icon="cog-outline" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsGeneral")}
            testID="settings-general-item"
          />
          <List.Item
            title={t("settings.timezone")}
            description={
              settings.timezone === "auto" ? undefined : settings.timezone
            }
            left={(props) => <List.Icon {...props} icon="earth" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsTimezone")}
            testID="settings-timezone-item"
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>{t("settings.categoryFeatures")}</List.Subheader>
          <List.Item
            title={t("settings.alarmDefaults")}
            left={(props) => <List.Icon {...props} icon="alarm" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsAlarmDefaults")}
            testID="settings-alarm-defaults-item"
          />
          <List.Item
            title={t("settings.calendarSection")}
            left={(props) => <List.Icon {...props} icon="calendar" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsCalendar")}
            testID="settings-calendar-item"
          />
          <List.Item
            title={t("settings.widget")}
            left={(props) => <List.Icon {...props} icon="widgets-outline" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsWidget")}
            testID="settings-widget-item"
          />
          <List.Item
            title={t("settings.backup")}
            left={(props) => (
              <List.Icon {...props} icon="cloud-upload-outline" />
            )}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsBackup")}
            testID="settings-backup-item"
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>{t("settings.categoryInfo")}</List.Subheader>
          <List.Item
            title={t("settings.about")}
            left={(props) => (
              <List.Icon {...props} icon="information-outline" />
            )}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsAbout")}
            testID="settings-about-item"
          />
          <List.Item
            title={t("settings.legal")}
            left={(props) => <List.Icon {...props} icon="gavel" />}
            right={renderChevron}
            onPress={() => navigation.navigate("SettingsLegal")}
            testID="settings-legal-item"
          />
        </List.Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
});
