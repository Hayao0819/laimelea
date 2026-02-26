import type { DismissalStrategy } from "./types";

const strategies = new Map<string, DismissalStrategy>();

export function registerStrategy(strategy: DismissalStrategy): void {
  strategies.set(strategy.id, strategy);
}

export function getStrategy(id: string): DismissalStrategy | undefined {
  return strategies.get(id);
}

export function getAllStrategies(): DismissalStrategy[] {
  return Array.from(strategies.values());
}

export function clearStrategies(): void {
  strategies.clear();
}
