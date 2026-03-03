import { renderHook } from "@testing-library/react-native";

import NativeFullscreenModule from "../../src/core/platform/native/NativeFullscreenModule";
import { useFullscreen } from "../../src/hooks/useFullscreen";

jest.mock("../../src/core/platform/native/NativeFullscreenModule", () => ({
  __esModule: true,
  default: {
    activate: jest.fn(),
    deactivate: jest.fn(),
    enterImmersive: jest.fn(),
    exitImmersive: jest.fn(),
  },
}));

const mockModule = NativeFullscreenModule as {
  activate: jest.Mock;
  deactivate: jest.Mock;
  enterImmersive: jest.Mock;
  exitImmersive: jest.Mock;
};

describe("useFullscreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls activate and enterImmersive on mount", () => {
    renderHook(() => useFullscreen());
    expect(mockModule.activate).toHaveBeenCalledTimes(1);
    expect(mockModule.enterImmersive).toHaveBeenCalledTimes(1);
  });

  it("calls deactivate and exitImmersive on unmount", () => {
    const { unmount } = renderHook(() => useFullscreen());
    unmount();
    expect(mockModule.deactivate).toHaveBeenCalledTimes(1);
    expect(mockModule.exitImmersive).toHaveBeenCalledTimes(1);
  });

  it("handles undefined NativeFullscreenModule gracefully", () => {
    // Temporarily replace mock default with undefined to simulate
    // NativeModules.FullscreenModule being unavailable
    jest.doMock(
      "../../src/core/platform/native/NativeFullscreenModule",
      () => ({
        __esModule: true,
        default: undefined,
      }),
    );

    // Use isolateModules to get a fresh useFullscreen that sees undefined module
    jest.isolateModules(() => {
      const { useFullscreen: useFullscreenUndefined } =
        require("../../src/hooks/useFullscreen") as typeof import("../../src/hooks/useFullscreen");

      // Manually simulate the hook's effect since we can't use renderHook
      // (importing @testing-library/react-native inside a test registers hooks)
      const React = require("react");
      let cleanup: (() => void) | void;

      const originalUseEffect = React.useEffect;
      React.useEffect = (cb: () => (() => void) | void) => {
        cleanup = cb();
      };

      try {
        expect(() => {
          useFullscreenUndefined();
        }).not.toThrow();

        expect(() => {
          if (typeof cleanup === "function") cleanup();
        }).not.toThrow();
      } finally {
        React.useEffect = originalUseEffect;
      }
    });
  });
});
