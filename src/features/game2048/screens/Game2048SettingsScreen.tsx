import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  List,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import {
  settingsAtom,
  hasGameStartedAtom,
  currentGameAtom,
  updateSettingsAtom,
  switchBoardSizeAtom,
} from "../atoms/game2048Atoms";
import type { BoardSize } from "../logic/gameTypes";

export function Game2048SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAtomValue(settingsAtom);
  const hasGameStarted = useAtomValue(hasGameStartedAtom);
  const currentGame = useAtomValue(currentGameAtom);
  const updateSettings = useSetAtom(updateSettingsAtom);
  const switchBoardSize = useSetAtom(switchBoardSizeAtom);

  const renderLuckyModeSwitch = useCallback(
    () => (
      <Switch
        value={settings.luckyMode}
        onValueChange={(v) => updateSettings({ luckyMode: v })}
        testID="lucky-mode-switch"
      />
    ),
    [settings.luckyMode, updateSettings],
  );

  const handleBoardSizeChange = useCallback(
    (value: string) => {
      switchBoardSize(Number(value) as BoardSize);
    },
    [switchBoardSize],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      testID="game2048-settings-screen"
    >
      <List.Section>
        <List.Subheader>{t("game2048.settings")}</List.Subheader>
        <List.Item
          title={t("game2048.luckyMode")}
          description={t("game2048.luckyModeDesc")}
          right={renderLuckyModeSwitch}
          testID="lucky-mode-item"
        />
      </List.Section>

      <List.Section>
        <List.Subheader>{t("game2048.boardSize")}</List.Subheader>
        <View style={styles.segmentContainer}>
          <SegmentedButtons
            value={String(currentGame.boardSize)}
            onValueChange={handleBoardSizeChange}
            buttons={[
              { value: "3", label: "3\u00d73", disabled: hasGameStarted },
              { value: "4", label: "4\u00d74", disabled: hasGameStarted },
              { value: "5", label: "5\u00d75", disabled: hasGameStarted },
              { value: "6", label: "6\u00d76", disabled: hasGameStarted },
            ]}
          />
          {hasGameStarted && (
            <Text
              variant="bodySmall"
              style={[styles.warningText, { color: theme.colors.error }]}
              testID="board-size-locked-text"
            >
              {t("game2048.boardSizeLocked")}
            </Text>
          )}
        </View>
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  segmentContainer: {
    paddingHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  warningText: {
    marginTop: spacing.sm,
  },
});
