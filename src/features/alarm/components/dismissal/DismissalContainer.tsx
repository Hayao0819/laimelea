import React from "react";

import type { DismissalMethod } from "../../../../models/Settings";
import { getStrategy } from "../../strategies";

interface DismissalContainerProps {
  method: DismissalMethod;
  difficulty: number;
  onDismiss: () => void;
  onSnooze: () => void;
  canSnooze: boolean;
}

export function DismissalContainer({
  method,
  difficulty,
  onDismiss,
  onSnooze,
  canSnooze,
}: DismissalContainerProps) {
  const strategy = getStrategy(method) ?? getStrategy("simple");

  if (!strategy) {
    return null;
  }

  const { Component } = strategy;

  return (
    <Component
      onDismiss={onDismiss}
      onSnooze={onSnooze}
      difficulty={difficulty}
      canSnooze={canSnooze}
    />
  );
}
