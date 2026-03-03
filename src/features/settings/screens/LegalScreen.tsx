import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Linking } from "react-native";
import { List } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { spacing } from "../../../app/spacing";

const MIT_LICENSE_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/LICENSE";
const MIT_SUSHI_LICENSE_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/LICENSE-SUSHI";
const PRIVACY_POLICY_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/docs/privacy-policy.md";

export function LegalScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handleOpenURL = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Silently ignore if URL cannot be opened
    }
  }, []);

  const handleLicenses = useCallback(() => {
    navigation.navigate("SettingsLicenses");
  }, [navigation]);

  const renderChevron = useCallback(
    (props: { color: string; style?: object }) => (
      <List.Icon {...props} icon="chevron-right" />
    ),
    [],
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} testID="legal-screen">
      <List.Section title={t("settings.appLicense")}>
        <List.Item
          title={t("settings.mitLicense")}
          description={t("settings.mitLicenseDesc")}
          onPress={() => handleOpenURL(MIT_LICENSE_URL)}
          right={renderChevron}
          testID="mit-license-item"
        />
        <List.Item
          title={t("settings.mitSushiLicense")}
          description={t("settings.mitSushiLicenseDesc")}
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
          onPress={handleLicenses}
          right={renderChevron}
          testID="licenses-item"
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
});
