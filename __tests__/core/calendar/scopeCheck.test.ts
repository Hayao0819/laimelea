import { hasCalendarScope } from "../../../src/core/calendar/scopeCheck";

describe("hasCalendarScope", () => {
  it("should return true for calendar.readonly scope", () => {
    expect(
      hasCalendarScope(["https://www.googleapis.com/auth/calendar.readonly"]),
    ).toBe(true);
  });

  it("should return true for full calendar scope", () => {
    expect(hasCalendarScope(["https://www.googleapis.com/auth/calendar"])).toBe(
      true,
    );
  });

  it("should return false for non-calendar scopes", () => {
    expect(hasCalendarScope(["openid", "email", "profile"])).toBe(false);
  });

  it("should return false for empty array", () => {
    expect(hasCalendarScope([])).toBe(false);
  });

  it("should return true when calendar.readonly is among multiple scopes", () => {
    expect(
      hasCalendarScope([
        "openid",
        "email",
        "https://www.googleapis.com/auth/calendar.readonly",
        "profile",
      ]),
    ).toBe(true);
  });
});
