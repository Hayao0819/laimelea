export interface CalendarEvent {
  id: string;
  sourceEventId: string;
  source: "google" | "local" | "huawei";
  title: string;
  description: string;
  startTimestampMs: number;
  endTimestampMs: number;
  allDay: boolean;
  colorId: string | null;
  calendarName: string;
  calendarId: string;
}
