import { MathDismissal } from "../components/dismissal/MathDismissal";
import type { DismissalStrategy } from "./types";

export const mathStrategy: DismissalStrategy = {
  id: "math",
  displayName: "dismissal.math",
  description: "dismissal.mathDesc",
  icon: "calculator",
  Component: MathDismissal,
};
