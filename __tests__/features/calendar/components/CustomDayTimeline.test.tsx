import { act, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { CustomDayTimeline } from "../../../../src/features/calendar/components/CustomDayTimeline";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

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

async function renderTimeline(
  props: Partial<React.ComponentProps<typeof CustomDayTimeline>> = {},
) {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);

  const defaultProps: React.ComponentProps<typeof CustomDayTimeline> = {
    dayStartMs: 0,
    events: [],
    ...props,
  };

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <CustomDayTimeline {...defaultProps} />
      </PaperProvider>
    </JotaiProvider>,
  );

  await act(async () => {});
  return { ...utils, store };
}

describe("CustomDayTimeline hour rows", () => {
  it("renders all 24 hour rows on an ordinary day", async () => {
    const dayStartMs = new Date(2026, 2, 7, 0, 0, 0, 0).getTime();

    const { queryAllByTestId } = await renderTimeline({ dayStartMs });

    expect(queryAllByTestId(/^timeline-hour-row-/)).toHaveLength(24);
  });

  // This environment's Jest sandbox does not honor a runtime
  // process.env.TZ reassignment (Date keeps resolving the host's real
  // zone), so a genuine America/New_York DST transition can't be forced
  // here. Simulate the underlying platform behavior instead: setHours()
  // normalizing a nonexistent local hour to the next valid instant.
  it("collapses the row when setHours normalizes to a different hour (simulated DST)", async () => {
    const originalSetHours = Date.prototype.setHours;
    jest.spyOn(Date.prototype, "setHours").mockImplementation(function (
      this: Date,
      hours: number,
      min?: number,
      sec?: number,
      ms?: number,
    ) {
      const normalizedHours = hours === 2 ? 3 : hours;
      return originalSetHours.call(this, normalizedHours, min, sec, ms);
    });

    try {
      const dayStartMs = new Date(2026, 2, 8, 0, 0, 0, 0).getTime();

      const { queryAllByTestId, queryByTestId } = await renderTimeline({
        dayStartMs,
      });

      expect(queryByTestId("timeline-hour-row-2")).toBeNull();
      expect(queryByTestId("timeline-hour-row-3")).toBeTruthy();
      expect(queryAllByTestId(/^timeline-hour-row-/)).toHaveLength(23);
    } finally {
      jest.restoreAllMocks();
    }
  });
});
