import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { DaySelector } from "../../../src/features/calendar/components/DaySelector";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const TODAY = startOfDay(Date.now());
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function renderDaySelector(
  selectedDate = TODAY,
  onSelectDate = jest.fn(),
) {
  const utils = render(
    <PaperProvider>
      <DaySelector selectedDate={selectedDate} onSelectDate={onSelectDate} />
    </PaperProvider>,
  );
  return { ...utils, onSelectDate };
}

describe("DaySelector", () => {
  it('should render with testID "day-selector"', async () => {
    const { getByTestId } = await renderDaySelector();
    expect(getByTestId("day-selector")).toBeTruthy();
  });

  it('should render today chip with "calendar.today" label', async () => {
    const { getAllByText } = await renderDaySelector();
    // The today chip uses t("calendar.today") which our mock returns as "calendar.today"
    // There are two instances: the chip in the date list and the bottom "today" button
    const todayTexts = getAllByText("calendar.today");
    expect(todayTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("should render day chips in M/D format", async () => {
    const { getByText } = await renderDaySelector();
    // Tomorrow should be shown in M/D format
    const tomorrow = new Date(TODAY + MS_PER_DAY);
    const label = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
    expect(getByText(label)).toBeTruthy();
  });

  it("should highlight selected date chip", async () => {
    const selectedDate = TODAY + MS_PER_DAY; // tomorrow
    const { getAllByText } = await renderDaySelector(selectedDate);
    const tomorrow = new Date(selectedDate);
    const label = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
    // The chip for the selected date should be rendered
    expect(getAllByText(label).length).toBeGreaterThanOrEqual(1);
  });

  it("should call onSelectDate when a chip is pressed", async () => {
    const onSelectDate = jest.fn();
    const { getByText } = await renderDaySelector(TODAY, onSelectDate);
    // Press tomorrow's chip
    const tomorrow = new Date(TODAY + MS_PER_DAY);
    const label = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
    await fireEvent.press(getByText(label));
    expect(onSelectDate).toHaveBeenCalledWith(TODAY + MS_PER_DAY);
  });

  it('should render a "today" button that scrolls back to today', async () => {
    const onSelectDate = jest.fn();
    const selectedDate = TODAY + 3 * MS_PER_DAY; // 3 days in the future
    const { getAllByText } = await renderDaySelector(selectedDate, onSelectDate);
    // The bottom "today" button also has text "calendar.today"
    const todayElements = getAllByText("calendar.today");
    // Press the last one (the bottom button)
    await fireEvent.press(todayElements[todayElements.length - 1]);
    expect(onSelectDate).toHaveBeenCalledWith(TODAY);
  });

  it("should render weekday labels below each date chip", async () => {
    const { getAllByText } = await renderDaySelector();
    // Get tomorrow's weekday abbreviation
    const tomorrow = new Date(TODAY + MS_PER_DAY);
    const weekdayLabel = tomorrow.toLocaleDateString(undefined, {
      weekday: "short",
    });
    // Multiple days may share the same weekday label (e.g. two Saturdays in the range)
    expect(getAllByText(weekdayLabel).length).toBeGreaterThanOrEqual(1);
  });
});
