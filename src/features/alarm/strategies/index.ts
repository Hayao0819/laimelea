import { mathStrategy } from "./mathStrategy";
import { registerStrategy } from "./registry";
import { shakeStrategy } from "./shakeStrategy";
import { simpleStrategy } from "./simpleStrategy";

registerStrategy(simpleStrategy);
registerStrategy(shakeStrategy);
registerStrategy(mathStrategy);

export { getAllStrategies,getStrategy, registerStrategy } from "./registry";
export type { DismissalComponentProps,DismissalStrategy } from "./types";
