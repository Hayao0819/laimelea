import { getNativeCalendarModule } from "../../../../src/core/platform/native/calendarModule";
import NativeCalendarModule from "../../../../src/core/platform/native/NativeCalendarModule";

describe("getNativeCalendarModule", () => {
  it("returns the generated native calendar module without wrapping it", () => {
    expect(getNativeCalendarModule()).toBe(NativeCalendarModule);
  });
});
