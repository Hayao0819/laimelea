import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";
import { Dialog, RadioButton } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import type { RingtoneInfo } from "../services/ringtoneService";
import { RingtoneService } from "../services/ringtoneService";

interface AlarmSoundPickerProps {
  soundUri: string | null;
  onSoundChange: (uri: string | null) => void;
  visible: boolean;
  onDismiss: () => void;
}

const SILENT_URI = "__silent__";

export function AlarmSoundPicker({
  soundUri,
  onSoundChange,
  visible,
  onDismiss,
}: AlarmSoundPickerProps) {
  const { t } = useTranslation();
  const [ringtones, setRingtones] = useState<RingtoneInfo[]>([]);

  useEffect(() => {
    if (visible) {
      RingtoneService.getAlarmRingtones()
        .then(setRingtones)
        .catch(() => {
          setRingtones([]);
        });
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    RingtoneService.stopPreview().catch(() => {});
    onDismiss();
  }, [onDismiss]);

  const currentValue =
    soundUri === null
      ? "default"
      : soundUri === SILENT_URI
        ? "silent"
        : soundUri;

  const handleValueChange = useCallback(
    (value: string) => {
      if (value === "default") {
        onSoundChange(null);
      } else if (value === "silent") {
        onSoundChange(SILENT_URI);
      } else {
        onSoundChange(value);
        RingtoneService.playPreview(value).catch(() => {});
      }
    },
    [onSoundChange],
  );

  return (
    <Dialog
      visible={visible}
      onDismiss={handleDismiss}
      testID="sound-picker-dialog"
    >
      <Dialog.Title>{t("alarm.soundSelect")}</Dialog.Title>
      <Dialog.ScrollArea style={styles.scrollArea}>
        <ScrollView>
          <RadioButton.Group
            value={currentValue}
            onValueChange={handleValueChange}
          >
            <RadioButton.Item
              label={t("alarm.soundDefault")}
              value="default"
              testID="sound-option-default"
            />
            <RadioButton.Item
              label={t("alarm.soundSilent")}
              value="silent"
              testID="sound-option-silent"
            />
            {ringtones.map((ringtone) => (
              <RadioButton.Item
                key={ringtone.uri}
                label={ringtone.title}
                value={ringtone.uri}
                testID={`sound-option-${ringtone.uri}`}
              />
            ))}
          </RadioButton.Group>
        </ScrollView>
      </Dialog.ScrollArea>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    maxHeight: 400,
    paddingHorizontal: spacing.sm,
  },
});
