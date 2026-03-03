import { useAtom } from "jotai";
import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SegmentedButtons } from "react-native-paper";

import { primaryTimeDisplayAtom } from "../../../atoms/settingsAtoms";

export function TimeToggle() {
  const [display, setDisplay] = useAtom(primaryTimeDisplayAtom);
  const { t } = useTranslation();

  return (
    <View testID="time-toggle">
      <SegmentedButtons<"custom" | "24h">
        value={display}
        onValueChange={(v) => setDisplay(v)}
        buttons={[
          { value: "custom", label: t("clock.customTime") },
          { value: "24h", label: t("clock.realTime") },
        ]}
      />
    </View>
  );
}
