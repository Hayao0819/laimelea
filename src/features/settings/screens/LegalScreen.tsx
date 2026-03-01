import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Linking } from "react-native";
import { List } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { spacing } from "../../../app/spacing";

const PRIVACY_POLICY_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/docs/privacy-policy.md";

export function LegalScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handlePrivacyPolicy = useCallback(async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
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
      <List.Section>
        <List.Item
          title={t("settings.privacyPolicy")}
          onPress={handlePrivacyPolicy}
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
