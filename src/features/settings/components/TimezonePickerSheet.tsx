import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { List, Modal, Portal, Searchbar, useTheme } from "react-native-paper";

import { radius,spacing } from "../../../app/spacing";

const TIMEZONE_LIST = [
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Jakarta",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Mexico_City",
  "America/Anchorage",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Australia/Sydney",
  "Australia/Perth",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "UTC",
];

function TimezoneItem({
  tz,
  selected,
  onPress,
}: {
  tz: string;
  selected: boolean;
  onPress: () => void;
}) {
  const renderIcon = useCallback(
    (props: { color: string; style: object }) => (
      <List.Icon {...props} icon={selected ? "check" : "clock-outline"} />
    ),
    [selected],
  );

  return (
    <List.Item
      title={tz}
      onPress={onPress}
      left={renderIcon}
      testID={`tz-item-${tz}`}
    />
  );
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (tz: string) => void;
  selectedTz: string | null;
}

export function TimezonePickerSheet({
  visible,
  onDismiss,
  onSelect,
  selectedTz,
}: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return TIMEZONE_LIST;
    const lower = query.toLowerCase();
    return TIMEZONE_LIST.filter((tz) => tz.toLowerCase().includes(lower));
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <TimezoneItem
        tz={item}
        selected={item === selectedTz}
        onPress={() => {
          onSelect(item);
          setQuery("");
        }}
      />
    ),
    [onSelect, selectedTz],
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => {
          onDismiss();
          setQuery("");
        }}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
        testID="timezone-picker-modal"
      >
        <Searchbar
          placeholder="Search timezone..."
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
          testID="timezone-searchbar"
        />
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item}
          style={styles.list}
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: spacing.lg,
    borderRadius: radius.lg,
    maxHeight: "80%",
    overflow: "hidden",
  },
  searchbar: {
    margin: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
});
