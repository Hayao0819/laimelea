import { NativeModules } from "react-native";

import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from "../../../src/core/platform/batteryOptimization";

describe("batteryOptimization", () => {
  const mockIsIgnoring = jest.fn();
  const mockRequest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    NativeModules.BatteryOptimizationModule = {
      isIgnoringBatteryOptimizations: mockIsIgnoring,
      requestIgnoreBatteryOptimizations: mockRequest,
    };
  });

  describe("isIgnoringBatteryOptimizations", () => {
    it("returns true when native module reports ignored", async () => {
      mockIsIgnoring.mockResolvedValue(true);
      const result = await isIgnoringBatteryOptimizations();
      expect(result).toBe(true);
      expect(mockIsIgnoring).toHaveBeenCalledTimes(1);
    });

    it("returns false when native module reports not ignored", async () => {
      mockIsIgnoring.mockResolvedValue(false);
      const result = await isIgnoringBatteryOptimizations();
      expect(result).toBe(false);
    });

    it("returns false when native module throws", async () => {
      mockIsIgnoring.mockRejectedValue(new Error("native error"));
      const result = await isIgnoringBatteryOptimizations();
      expect(result).toBe(false);
    });

    it("returns true when native module is undefined", async () => {
      NativeModules.BatteryOptimizationModule = undefined;
      const result = await isIgnoringBatteryOptimizations();
      expect(result).toBe(true);
    });
  });

  describe("requestIgnoreBatteryOptimizations", () => {
    it("returns true when native module resolves true", async () => {
      mockRequest.mockResolvedValue(true);
      const result = await requestIgnoreBatteryOptimizations();
      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it("returns false when native module throws", async () => {
      mockRequest.mockRejectedValue(new Error("native error"));
      const result = await requestIgnoreBatteryOptimizations();
      expect(result).toBe(false);
    });

    it("returns true when native module is undefined", async () => {
      NativeModules.BatteryOptimizationModule = undefined;
      const result = await requestIgnoreBatteryOptimizations();
      expect(result).toBe(true);
    });
  });
});
