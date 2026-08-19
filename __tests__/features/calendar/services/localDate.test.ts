import {
  addLocalDays,
  endOfLocalDay,
  intersectsLocalDay,
  startOfLocalWeek,
} from "../../../../src/features/calendar/services/localDate";

describe("localDate", () => {
  const originalTimezone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  });

  it("uses the next local midnight across the spring DST transition", () => {
    const march8 = new Date(2026, 2, 8, 0, 0, 0, 0).getTime();
    const march9 = new Date(2026, 2, 9, 0, 0, 0, 0).getTime();

    expect(endOfLocalDay(march8)).toBe(march9);
    expect(endOfLocalDay(march8) - march8).toBe(march9 - march8);
    expect(addLocalDays(march8, 1)).toBe(march9);
  });

  it("treats day intervals as half-open and retains overnight events", () => {
    const march8 = new Date(2026, 2, 8, 0, 0, 0, 0).getTime();
    const march9 = new Date(2026, 2, 9, 0, 0, 0, 0).getTime();
    const march10 = new Date(2026, 2, 10, 0, 0, 0, 0).getTime();
    const overnightStart = new Date(2026, 2, 8, 23, 0, 0, 0).getTime();
    const overnightEnd = new Date(2026, 2, 9, 1, 0, 0, 0).getTime();

    expect(intersectsLocalDay(overnightStart, overnightEnd, march8)).toBe(true);
    expect(intersectsLocalDay(overnightStart, overnightEnd, march9)).toBe(true);
    expect(intersectsLocalDay(march9, march10, march8)).toBe(false);
  });

  it.each([
    [0, 8],
    [1, 9],
    [6, 7],
  ] as const)("starts weeks on configured day %i", (firstDayOfWeek, day) => {
    const wednesday = new Date(2026, 2, 11, 12, 0, 0, 0).getTime();

    expect(
      new Date(startOfLocalWeek(wednesday, firstDayOfWeek)).getDate(),
    ).toBe(day);
  });
});
