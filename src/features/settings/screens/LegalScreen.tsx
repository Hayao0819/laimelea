import { useNavigation } from "@react-navigation/native";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { List, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";

const MIT_LICENSE_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/LICENSE";
const MIT_SUSHI_LICENSE_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/LICENSE-SUSHI";
const PRIVACY_POLICY_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/docs/privacy-policy.md";

export function LegalScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();

  const handleOpenURL = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Silently ignore if URL cannot be opened
    }
  }, []);

  const renderChevron = useCallback(
    (props: { color: string; style?: object }) => (
      <List.Icon {...props} icon="chevron-right" />
    ),
    [],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="legal-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <List.Section title={t("settings.appLicense")}>
          <List.Item
            title={t("settings.mitLicense")}
            onPress={() => handleOpenURL(MIT_LICENSE_URL)}
            right={renderChevron}
            testID="mit-license-item"
          />
          <List.Item
            title={t("settings.mitSushiLicense")}
            onPress={() => handleOpenURL(MIT_SUSHI_LICENSE_URL)}
            right={renderChevron}
            testID="mit-sushi-license-item"
          />
        </List.Section>

        <List.Section>
          <List.Item
            title={t("settings.privacyPolicy")}
            onPress={() => handleOpenURL(PRIVACY_POLICY_URL)}
            right={renderChevron}
            testID="privacy-policy-item"
          />
          <List.Item
            title={t("settings.openSourceLicenses")}
            onPress={() => navigation.navigate("SettingsLicenses")}
            right={renderChevron}
            testID="licenses-item"
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
