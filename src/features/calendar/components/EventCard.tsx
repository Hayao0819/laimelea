import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, Chip, IconButton, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import type { CalendarEvent } from "../../../models/CalendarEvent";

interface EventCardProps {
  event: CalendarEvent;
  onCreateAlarm?: (event: CalendarEvent) => void;
  onPress?: (event: CalendarEvent) => void;
}

function formatRealTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EventCard({ event, onCreateAlarm, onPress }: EventCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAtomValue(settingsAtom);

  const customTime = realToCustom(event.startTimestampMs, settings.cycleConfig);
  const customTimeStr = formatCustomTimeShort(customTime);

  return (
    <Card
      style={styles.card}
      mode="outlined"
      onPress={onPress ? () => onPress(event) : undefined}
      accessibilityLabel={`${event.title}${event.allDay ? `, ${t("calendar.allDay")}` : `, ${formatRealTime(event.startTimestampMs)}`}`}
    >
      <Card.Content style={styles.content}>
        <View style={styles.row}>
          <View
            style={[
              styles.colorDot,
              {
                backgroundColor: event.colorId ?? theme.colors.primary,
              },
            ]}
          />
          <View style={styles.textContainer}>
            <Text variant="titleMedium" numberOfLines={1}>
              {event.title}
            </Text>
            {event.allDay ? (
              <Chip compact style={styles.allDayChip}>
                {t("calendar.allDay")}
              </Chip>
            ) : (
              <View style={styles.timeRow}>
                <Text variant="bodyMedium" style={styles.realTime}>
                  {t("calendar.realTime", {
                    time: formatRealTime(event.startTimestampMs),
                  })}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.primary }}
                >
                  {t("calendar.customTime", { time: customTimeStr })}
                </Text>
              </View>
            )}
          </View>
          {!event.allDay && onCreateAlarm && (
            <IconButton
              icon="alarm-plus"
              size={20}
              onPress={() => onCreateAlarm(event)}
              accessibilityLabel={t("calendar.createAlarm")}
              testID={`event-create-alarm-${event.id}`}
            />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  content: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  realTime: {
    fontVariant: ["tabular-nums"],
  },
  allDayChip: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
});
