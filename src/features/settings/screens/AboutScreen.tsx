import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { Divider, List, Snackbar, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { useSnackbar } from "../hooks/useSnackbar";

const { version } = require("../../../../package.json");

const UNLOCK_STORAGE_KEY = "@laimelea/game_2048_unlocked";
const TAP_TARGET = 7;
const TAP_HINT_THRESHOLD = 5;
const TAP_RESET_MS = 2000;
const GITHUB_URL = "https://github.com/Hayao0819";
const TWITTER_URL = "https://twitter.com/Hayao0819";
const REPO_URL = "https://github.com/Hayao0819/laimelea";
const MIT_LICENSE_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/LICENSE";
const MIT_SUSHI_LICENSE_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/LICENSE-SUSHI";
const PRIVACY_POLICY_URL =
  "https://github.com/Hayao0819/laimelea/blob/master/docs/privacy-policy.md";

export function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const snackbar = useSnackbar();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(UNLOCK_STORAGE_KEY).then((val) => {
      if (val) setIsUnlocked(true);
    });
  }, []);

  const handleVersionTap = useCallback(async () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    tapCount.current += 1;
    const count = tapCount.current;

    if (count >= TAP_TARGET) {
      tapCount.current = 0;
      tapTimer.current = null;

      if (!isUnlocked) {
        await AsyncStorage.setItem(UNLOCK_STORAGE_KEY, String(Date.now()));
        setIsUnlocked(true);
      }

      snackbar.show(t("settings.easterEggUnlocked"));
      navigation.navigate("Game2048");
      return;
    }

    if (count >= TAP_HINT_THRESHOLD) {
      snackbar.show(t("settings.tapMore", { count: TAP_TARGET - count }));
    }

    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
      tapTimer.current = null;
    }, TAP_RESET_MS);
  }, [isUnlocked, navigation, snackbar, t]);

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
      testID="about-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.appName}>
            Laimelea
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.appDescription,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("settings.appDescription")}
          </Text>
        </View>

        <List.Section title={t("settings.aboutApp")}>
          <List.Item
            title={t("settings.version")}
            description={version}
            onPress={handleVersionTap}
            testID="version-item"
          />
          <List.Item
            title={t("settings.sourceCode")}
            description="GitHub"
            onPress={() => handleOpenURL(REPO_URL)}
            right={renderChevron}
            testID="repo-item"
          />
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

        <Divider />

        <List.Section title={t("settings.aboutDeveloper")}>
          <List.Item
            title={t("settings.developer")}
            description={t("settings.developerName")}
            testID="developer-item"
          />
          <List.Item
            title={t("settings.developerGithub")}
            onPress={() => handleOpenURL(GITHUB_URL)}
            right={renderChevron}
            testID="github-item"
          />
          <List.Item
            title={t("settings.developerTwitter")}
            onPress={() => handleOpenURL(TWITTER_URL)}
            right={renderChevron}
            testID="twitter-item"
          />
        </List.Section>

        {isUnlocked && (
          <>
            <Divider />
            <List.Section title={t("settings.games")}>
              <List.Item
                title={t("settings.game2048")}
                onPress={() => navigation.navigate("Game2048")}
                right={renderChevron}
                testID="game-2048-item"
              />
            </List.Section>
          </>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={snackbar.dismiss}
        duration={3000}
        testID="about-snackbar"
      >
        {snackbar.message}
      </Snackbar>
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
  header: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  appName: {
    fontWeight: "bold",
    marginBottom: spacing.xs,
  },
  appDescription: {
    textAlign: "center",
  },
});
