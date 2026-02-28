import { NativeModules } from "react-native";

interface FullscreenModuleSpec {
  activate(): void;
  deactivate(): void;
  enterImmersive(): void;
  exitImmersive(): void;
}

export default NativeModules.FullscreenModule as
  | FullscreenModuleSpec
  | undefined;
