import React from "react";
import { View } from "react-native";
import { useAtom } from "jotai";
import { SegmentedButtons } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { primaryTimeDisplayAtom } from "../../../atoms/settingsAtoms";

export function TimeToggle() {
  const [display, setDisplay] = useAtom(primaryTimeDisplayAtom);
  const { t } = useTranslation();

  return (
    <View testID="time-toggle">
      <SegmentedButtons
        value={display}
        onValueChange={(v) => setDisplay(v as "custom" | "24h")}
        buttons={[
          { value: "custom", label: t("clock.customTime") },
          { value: "24h", label: t("clock.realTime") },
        ]}
      />
    </View>
  );
}
