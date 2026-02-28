import { useEffect } from "react";
import NativeFullscreenModule from "../core/platform/native/NativeFullscreenModule";

export function useFullscreen() {
  useEffect(() => {
    NativeFullscreenModule?.activate();
    NativeFullscreenModule?.enterImmersive();
    return () => {
      NativeFullscreenModule?.deactivate();
      NativeFullscreenModule?.exitImmersive();
    };
  }, []);
}
