import { SimpleDismissal } from "../components/dismissal/SimpleDismissal";
import type { DismissalStrategy } from "./types";

export const simpleStrategy: DismissalStrategy = {
  id: "simple",
  displayName: "dismissal.simple",
  description: "dismissal.simpleDesc",
  icon: "gesture-tap",
  Component: SimpleDismissal,
};
