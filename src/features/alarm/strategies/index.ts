import { registerStrategy } from "./registry";
import { simpleStrategy } from "./simpleStrategy";
import { shakeStrategy } from "./shakeStrategy";
import { mathStrategy } from "./mathStrategy";

registerStrategy(simpleStrategy);
registerStrategy(shakeStrategy);
registerStrategy(mathStrategy);

export { registerStrategy, getStrategy, getAllStrategies } from "./registry";
export type { DismissalStrategy, DismissalComponentProps } from "./types";
