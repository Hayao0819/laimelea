import type { FC } from "react";

export interface DismissalComponentProps {
  onDismiss: () => void;
  onSnooze: () => void;
  difficulty: number; // 1=easy, 2=medium, 3=hard
  canSnooze: boolean;
}

export interface DismissalStrategy {
  id: string;
  displayName: string; // i18n key (e.g. "dismissal.simple")
  description: string; // i18n key (e.g. "dismissal.simpleDesc")
  icon: string; // Material Design Icons name
  Component: FC<DismissalComponentProps>;
}
