import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  getManufacturer(): string;
}

export default TurboModuleRegistry.get<Spec>("DeviceInfoModule");
