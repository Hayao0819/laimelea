import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  getCalendars(): Promise<
    ReadonlyArray<{
      id: string;
      name: string;
      color: string | null;
      isPrimary: boolean;
    }>
  >;

  getEventInstances(
    startMs: number,
    endMs: number,
  ): Promise<
    ReadonlyArray<{
      id: string;
      calendarId: string;
      calendarName: string;
      title: string;
      description: string;
      startMs: number;
      endMs: number;
      allDay: boolean;
      color: string | null;
    }>
  >;
}

export default TurboModuleRegistry.get<Spec>("CalendarModule");
