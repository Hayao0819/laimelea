import "./src/core/notifications/backgroundHandler";

import { AppRegistry } from "react-native";

import { name as appName } from "./app.json";
import App from "./src/app/App";
import { registerClockWidgetHandler } from "./src/features/widget/WidgetTaskHandler";

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask(
  "RescheduleAlarmsTask",
  () => require("./src/features/alarm/services/bootRescheduleTask").default,
);
registerClockWidgetHandler();
