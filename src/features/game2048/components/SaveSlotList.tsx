import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  Divider,
  IconButton,
  List,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import type { GameSnapshot } from "../logic/gameTypes";
import { spacing } from "../../../app/spacing";

interface SnapshotItemProps {
  snapshot: GameSnapshot;
  onLoad: (snapshot: GameSnapshot) => void;
  onDelete: (snapshotId: string) => void;
}

function SnapshotItemActions({
  snapshot,
  onLoad,
  onDelete,
}: SnapshotItemProps) {
  return (
    <View style={styles.actions}>
      <IconButton
        icon="play"
        onPress={() => onLoad(snapshot)}
        size={20}
        testID={`load-${snapshot.id}`}
      />
      <IconButton
        icon="delete"
        onPress={() => onDelete(snapshot.id)}
        size={20}
        testID={`delete-${snapshot.id}`}
      />
    </View>
  );
}

function SnapshotItem({ snapshot, onLoad, onDelete }: SnapshotItemProps) {
  const { t } = useTranslation();
  const renderRight = useCallback(
    () => (
      <SnapshotItemActions
        snapshot={snapshot}
        onLoad={onLoad}
        onDelete={onDelete}
      />
    ),
    [snapshot, onLoad, onDelete],
  );

  return (
    <List.Item
      title={snapshot.name}
      description={`${t("game2048.score")}: ${snapshot.state.score} \u00b7 ${format(new Date(snapshot.timestamp), "MM/dd HH:mm")} \u00b7 ${snapshot.state.boardSize}\u00d7${snapshot.state.boardSize}`}
      right={renderRight}
      testID={`snapshot-${snapshot.id}`}
    />
  );
}

interface SaveSlotListProps {
  visible: boolean;
  onDismiss: () => void;
  snapshots: GameSnapshot[];
  onSave: (name: string) => void;
  onLoad: (snapshot: GameSnapshot) => void;
  onDelete: (snapshotId: string) => void;
}

export function SaveSlotList({
  visible,
  onDismiss,
  snapshots,
  onSave,
  onLoad,
  onDelete,
}: SaveSlotListProps) {
  const { t } = useTranslation();
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = useCallback(() => {
    const name = saveName.trim() || `Save #${snapshots.length + 1}`;
    onSave(name);
    setSaveName("");
    setShowSaveInput(false);
  }, [saveName, snapshots.length, onSave]);

  const renderItem = useCallback(
    ({ item }: { item: GameSnapshot }) => (
      <SnapshotItem
        snapshot={item}
        onLoad={onLoad}
        onDelete={onDelete}
      />
    ),
    [onLoad, onDelete],
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID="save-slot-dialog">
        <Dialog.Title>{t("game2048.snapshots")}</Dialog.Title>
        <Dialog.Content>
          {snapshots.length === 0 ? (
            <Text>{t("game2048.noSnapshots")}</Text>
          ) : (
            <FlatList
              data={snapshots}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={Divider}
              style={styles.list}
            />
          )}
          {showSaveInput ? (
            <View style={styles.saveInput}>
              <TextInput
                mode="outlined"
                label={t("game2048.saveName")}
                value={saveName}
                onChangeText={setSaveName}
                style={styles.input}
                testID="save-name-input"
              />
              <Button
                mode="contained"
                onPress={handleSave}
                testID="confirm-save-button"
              >
                {t("game2048.save")}
              </Button>
            </View>
          ) : (
            <Button
              mode="outlined"
              onPress={() => setShowSaveInput(true)}
              style={styles.saveButton}
              icon="content-save"
              testID="save-current-button"
            >
              {t("game2048.save")}
            </Button>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t("common.ok")}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 300,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.md,
  },
});
