import { ShakeDismissal } from "../components/dismissal/ShakeDismissal";
import type { DismissalStrategy } from "./types";

export const shakeStrategy: DismissalStrategy = {
  id: "shake",
  displayName: "dismissal.shake",
  description: "dismissal.shakeDesc",
  icon: "cellphone-wireless",
  Component: ShakeDismissal,
};
