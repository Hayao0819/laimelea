import {
  fetchCalendarList,
  fetchEvents,
  parseEventTimestamp,
  AuthExpiredError,
  ScopeDeniedError,
} from "../../../src/core/calendar/googleCalendarApi";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchCalendarList", () => {
  it("should fetch all calendars", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "cal-1",
            summary: "Work",
            backgroundColor: "#0000ff",
            primary: true,
          },
        ],
      }),
    );

    const result = await fetchCalendarList("token-123");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "cal-1",
      summary: "Work",
      backgroundColor: "#0000ff",
      primary: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/calendarList"),
      expect.objectContaining({
        headers: { Authorization: "Bearer token-123" },
      }),
    );
  });

  it("should paginate through all pages", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "cal-1",
              summary: "Work",
              backgroundColor: null,
              primary: true,
            },
          ],
          nextPageToken: "page2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "cal-2",
              summary: "Personal",
              backgroundColor: "#ff0000",
              primary: false,
            },
          ],
        }),
      );

    const result = await fetchCalendarList("token-123");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("cal-1");
    expect(result[1].id).toBe("cal-2");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const secondCallUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("pageToken=page2");
  });

  it("should throw AuthExpiredError on 401", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(fetchCalendarList("expired-token")).rejects.toThrow(
      AuthExpiredError,
    );
  });

  it("should throw ScopeDeniedError on 403", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 403));
    await expect(fetchCalendarList("no-scope-token")).rejects.toThrow(
      ScopeDeniedError,
    );
  });
});

describe("fetchEvents", () => {
  const timeMin = new Date("2026-01-01T00:00:00Z");
  const timeMax = new Date("2026-01-31T00:00:00Z");

  it("should fetch events for a calendar", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "ev-1",
            summary: "Meeting",
            description: "Team sync",
            status: "confirmed",
            start: { dateTime: "2026-01-15T10:00:00Z" },
            end: { dateTime: "2026-01-15T11:00:00Z" },
          },
        ],
      }),
    );

    const result = await fetchEvents("token", "cal-1", timeMin, timeMax);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("Meeting");

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain("singleEvents=true");
    expect(callUrl).toContain("orderBy=startTime");
    expect(callUrl).toContain(encodeURIComponent("cal-1"));
  });

  it("should filter out cancelled events", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "ev-1",
            summary: "Active",
            description: "",
            status: "confirmed",
            start: { dateTime: "2026-01-15T10:00:00Z" },
            end: { dateTime: "2026-01-15T11:00:00Z" },
          },
          {
            id: "ev-2",
            summary: "Cancelled",
            description: "",
            status: "cancelled",
            start: { dateTime: "2026-01-16T10:00:00Z" },
            end: { dateTime: "2026-01-16T11:00:00Z" },
          },
        ],
      }),
    );

    const result = await fetchEvents("token", "cal-1", timeMin, timeMax);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("Active");
  });

  it("should paginate events", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "ev-1",
              summary: "First",
              description: "",
              status: "confirmed",
              start: { dateTime: "2026-01-15T10:00:00Z" },
              end: { dateTime: "2026-01-15T11:00:00Z" },
            },
          ],
          nextPageToken: "next",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "ev-2",
              summary: "Second",
              description: "",
              status: "confirmed",
              start: { dateTime: "2026-01-16T10:00:00Z" },
              end: { dateTime: "2026-01-16T11:00:00Z" },
            },
          ],
        }),
      );

    const result = await fetchEvents("token", "cal-1", timeMin, timeMax);
    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should throw AuthExpiredError on 401", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(
      fetchEvents("token", "cal-1", timeMin, timeMax),
    ).rejects.toThrow(AuthExpiredError);
  });

  it("should throw ScopeDeniedError on 403", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 403));
    await expect(
      fetchEvents("token", "cal-1", timeMin, timeMax),
    ).rejects.toThrow(ScopeDeniedError);
  });
});

describe("parseEventTimestamp", () => {
  it("should parse timed events", () => {
    const result = parseEventTimestamp({
      id: "ev-1",
      summary: "Meeting",
      description: "",
      status: "confirmed",
      start: { dateTime: "2026-01-15T10:00:00Z" },
      end: { dateTime: "2026-01-15T11:00:00Z" },
    });

    expect(result.allDay).toBe(false);
    expect(result.startMs).toBe(new Date("2026-01-15T10:00:00Z").getTime());
    expect(result.endMs).toBe(new Date("2026-01-15T11:00:00Z").getTime());
  });

  it("should parse all-day events", () => {
    const result = parseEventTimestamp({
      id: "ev-2",
      summary: "Holiday",
      description: "",
      status: "confirmed",
      start: { date: "2026-01-15" },
      end: { date: "2026-01-16" },
    });

    expect(result.allDay).toBe(true);
    expect(result.startMs).toBe(new Date("2026-01-15T00:00:00").getTime());
    expect(result.endMs).toBe(new Date("2026-01-16T00:00:00").getTime());
  });
});
