import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, Linking } from "react-native";
import { List, Text, Snackbar, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { spacing } from "../../../app/spacing";
import { useSnackbar } from "../hooks/useSnackbar";

const { version } = require("../../../../package.json");

const UNLOCK_STORAGE_KEY = "@laimelea/game_2048_unlocked";
const TAP_TARGET = 7;
const TAP_HINT_THRESHOLD = 5;
const TAP_RESET_MS = 2000;
const GITHUB_URL = "https://github.com/Hayao0819";

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
        await AsyncStorage.setItem(
          UNLOCK_STORAGE_KEY,
          String(Date.now()),
        );
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

  const handleGithubPress = useCallback(async () => {
    try {
      await Linking.openURL(GITHUB_URL);
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
            style={[styles.appDescription, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("settings.appDescription")}
          </Text>
        </View>

        <List.Section>
          <List.Item
            title={t("settings.version")}
            description={version}
            onPress={handleVersionTap}
            testID="version-item"
          />
          <List.Item
            title={t("settings.developer")}
            description={t("settings.developerName")}
            testID="developer-item"
          />
          <List.Item
            title={t("settings.developerGithub")}
            onPress={handleGithubPress}
            right={renderChevron}
            testID="github-item"
          />
        </List.Section>

        {isUnlocked && (
          <List.Section>
            <List.Item
              title={t("settings.game2048")}
              onPress={() => navigation.navigate("Game2048")}
              right={renderChevron}
              testID="game-2048-item"
            />
          </List.Section>
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
