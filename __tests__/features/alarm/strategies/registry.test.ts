import {
  registerStrategy,
  getStrategy,
  getAllStrategies,
  clearStrategies,
} from "../../../../src/features/alarm/strategies/registry";
import type { DismissalStrategy } from "../../../../src/features/alarm/strategies/types";

const mockStrategy: DismissalStrategy = {
  id: "test",
  displayName: "test.name",
  description: "test.desc",
  icon: "test-icon",
  Component: () => null,
};

const mockStrategy2: DismissalStrategy = {
  id: "test2",
  displayName: "test2.name",
  description: "test2.desc",
  icon: "test2-icon",
  Component: () => null,
};

describe("DismissalStrategy Registry", () => {
  beforeEach(() => {
    clearStrategies();
  });

  it("should register and retrieve a strategy by id", () => {
    registerStrategy(mockStrategy);
    expect(getStrategy("test")).toBe(mockStrategy);
  });

  it("should return undefined for unknown id", () => {
    expect(getStrategy("nonexistent")).toBeUndefined();
  });

  it("should return all registered strategies", () => {
    registerStrategy(mockStrategy);
    registerStrategy(mockStrategy2);
    const all = getAllStrategies();
    expect(all).toHaveLength(2);
    expect(all).toContain(mockStrategy);
    expect(all).toContain(mockStrategy2);
  });

  it("should overwrite strategy with same id", () => {
    registerStrategy(mockStrategy);
    const updated = { ...mockStrategy, displayName: "updated.name" };
    registerStrategy(updated);
    expect(getStrategy("test")?.displayName).toBe("updated.name");
    expect(getAllStrategies()).toHaveLength(1);
  });

  it("should clear all strategies", () => {
    registerStrategy(mockStrategy);
    registerStrategy(mockStrategy2);
    clearStrategies();
    expect(getAllStrategies()).toHaveLength(0);
  });
});
