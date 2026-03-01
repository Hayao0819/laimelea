import React, { useCallback } from "react";
import { FlatList, StyleSheet, Linking, View } from "react-native";
import { List, Divider, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import licensesData from "../../../generated/licenses.json";

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repository: string | null;
}

const licenses = licensesData as LicenseEntry[];

export function LicensesScreen() {
  const { t } = useTranslation();

  const handlePress = useCallback(async (repository: string) => {
    try {
      await Linking.openURL(repository);
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

  const renderItem = useCallback(
    ({ item }: { item: LicenseEntry }) => (
      <List.Item
        title={item.name}
        description={`${item.license} \u00b7 v${item.version}`}
        onPress={
          item.repository ? () => handlePress(item.repository!) : undefined
        }
        right={item.repository ? renderChevron : undefined}
      />
    ),
    [handlePress, renderChevron],
  );

  const keyExtractor = useCallback(
    (item: LicenseEntry) => `${item.name}@${item.version}`,
    [],
  );

  if (licenses.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="licenses-screen">
        <Text variant="bodyLarge">{t("settings.noLicenses")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={licenses}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={Divider}
      contentContainerStyle={styles.list}
      testID="licenses-screen"
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
});
