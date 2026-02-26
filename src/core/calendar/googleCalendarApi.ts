export class AuthExpiredError extends Error {
  constructor() {
    super("Access token expired");
    this.name = "AuthExpiredError";
  }
}

export class ScopeDeniedError extends Error {
  constructor() {
    super("Calendar scope not granted");
    this.name = "ScopeDeniedError";
  }
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  backgroundColor: string | null;
  primary: boolean;
}

export interface GoogleEventResource {
  id: string;
  summary: string;
  description: string;
  status: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
}

const BASE_URL = "https://www.googleapis.com/calendar/v3";

async function apiGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    throw new AuthExpiredError();
  }
  if (response.status === 403) {
    throw new ScopeDeniedError();
  }
  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

interface CalendarListResponse {
  items: GoogleCalendarListEntry[];
  nextPageToken?: string;
}

export async function fetchCalendarList(
  accessToken: string,
): Promise<GoogleCalendarListEntry[]> {
  const calendars: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {};
    if (pageToken) {
      params.pageToken = pageToken;
    }

    const data = await apiGet<CalendarListResponse>(
      accessToken,
      "/users/me/calendarList",
      params,
    );

    calendars.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return calendars;
}

interface EventListResponse {
  items: GoogleEventResource[];
  nextPageToken?: string;
}

export async function fetchEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleEventResource[]> {
  const events: GoogleEventResource[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    };
    if (pageToken) {
      params.pageToken = pageToken;
    }

    const data = await apiGet<EventListResponse>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      params,
    );

    events.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events.filter((e) => e.status !== "cancelled");
}

export function parseEventTimestamp(event: GoogleEventResource): {
  startMs: number;
  endMs: number;
  allDay: boolean;
} {
  if (event.start.dateTime && event.end.dateTime) {
    return {
      startMs: new Date(event.start.dateTime).getTime(),
      endMs: new Date(event.end.dateTime).getTime(),
      allDay: false,
    };
  }

  // All-day event: start.date = "YYYY-MM-DD"
  const startMs = new Date(event.start.date + "T00:00:00").getTime();
  const endMs = new Date(event.end.date + "T00:00:00").getTime();
  return { startMs, endMs, allDay: true };
}
