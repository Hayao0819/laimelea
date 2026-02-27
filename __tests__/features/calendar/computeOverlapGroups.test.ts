import { computeOverlapGroups } from "../../../src/features/calendar/components/CustomDayTimeline";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

function makeEvent(
  id: string,
  startHour: number,
  endHour: number,
): CalendarEvent {
  const base = new Date("2026-03-01T00:00:00Z").getTime();
  return {
    id,
    sourceEventId: `src-${id}`,
    source: "local",
    title: `Event ${id}`,
    description: "",
    startTimestampMs: base + startHour * 60 * 60 * 1000,
    endTimestampMs: base + endHour * 60 * 60 * 1000,
    allDay: false,
    colorId: null,
    calendarName: "Test",
    calendarId: "cal-1",
  };
}

describe("computeOverlapGroups", () => {
  it("returns empty array for no events", () => {
    expect(computeOverlapGroups([])).toEqual([]);
  });

  it("places a single event in one group with one column", () => {
    const events = [makeEvent("a", 9, 10)];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toBe(1);
    expect(groups[0].events).toHaveLength(1);
    expect(groups[0].columnAssignments.get("a")).toBe(0);
  });

  it("places non-overlapping events in separate groups", () => {
    const events = [makeEvent("a", 9, 10), makeEvent("b", 11, 12)];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(2);
    expect(groups[0].events[0].id).toBe("a");
    expect(groups[1].events[0].id).toBe("b");
    expect(groups[0].columns).toBe(1);
    expect(groups[1].columns).toBe(1);
  });

  it("places adjacent (non-overlapping) events in separate groups", () => {
    const events = [makeEvent("a", 9, 10), makeEvent("b", 10, 11)];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(2);
  });

  it("groups two overlapping events together with 2 columns", () => {
    const events = [makeEvent("a", 9, 11), makeEvent("b", 10, 12)];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toBe(2);
    expect(groups[0].columnAssignments.get("a")).toBe(0);
    expect(groups[0].columnAssignments.get("b")).toBe(1);
  });

  it("groups three overlapping events with 3 columns", () => {
    const events = [
      makeEvent("a", 9, 12),
      makeEvent("b", 10, 13),
      makeEvent("c", 11, 14),
    ];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toBe(3);
    expect(groups[0].columnAssignments.get("a")).toBe(0);
    expect(groups[0].columnAssignments.get("b")).toBe(1);
    expect(groups[0].columnAssignments.get("c")).toBe(2);
  });

  it("reuses columns when earlier event ends before later starts", () => {
    // a: 9-10, b: 9-11, c: 10-12
    // a and b overlap -> columns 0, 1
    // c starts at 10, a ends at 10, so c can reuse column 0
    const events = [
      makeEvent("a", 9, 10),
      makeEvent("b", 9, 11),
      makeEvent("c", 10, 12),
    ];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toBe(2);
    expect(groups[0].columnAssignments.get("a")).toBe(0);
    expect(groups[0].columnAssignments.get("b")).toBe(1);
    expect(groups[0].columnAssignments.get("c")).toBe(0);
  });

  it("handles events in unsorted order", () => {
    const events = [makeEvent("b", 10, 12), makeEvent("a", 9, 11)];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toBe(2);
    // After sorting, "a" comes first
    expect(groups[0].columnAssignments.get("a")).toBe(0);
    expect(groups[0].columnAssignments.get("b")).toBe(1);
  });

  it("handles mixed overlapping and non-overlapping events", () => {
    const events = [
      makeEvent("a", 9, 11),
      makeEvent("b", 10, 12),
      makeEvent("c", 14, 15),
      makeEvent("d", 14, 16),
    ];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(2);
    expect(groups[0].events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(groups[0].columns).toBe(2);
    expect(groups[1].events.map((e) => e.id)).toEqual(["c", "d"]);
    expect(groups[1].columns).toBe(2);
  });

  it("handles chain of transitively overlapping events", () => {
    // a: 9-11, b: 10-12, c: 11-13
    // a overlaps b, b overlaps c, so all are in one group
    // but a and c don't directly overlap -> c can reuse column 0
    const events = [
      makeEvent("a", 9, 11),
      makeEvent("b", 10, 12),
      makeEvent("c", 11, 13),
    ];
    const groups = computeOverlapGroups(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toBe(2);
    expect(groups[0].columnAssignments.get("a")).toBe(0);
    expect(groups[0].columnAssignments.get("b")).toBe(1);
    expect(groups[0].columnAssignments.get("c")).toBe(0);
  });
});
