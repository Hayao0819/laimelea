import { AppRegistry } from "react-native";
import App from "./src/app/App";
import { name as appName } from "./app.json";
import "./src/core/notifications/backgroundHandler";
import { registerClockWidgetHandler } from "./src/features/widget/WidgetTaskHandler";

AppRegistry.registerComponent(appName, () => App);
registerClockWidgetHandler();
