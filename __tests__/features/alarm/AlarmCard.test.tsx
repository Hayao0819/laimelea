import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { AlarmCard } from "../../../src/features/alarm/components/AlarmCard";
import type { Alarm } from "../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("date-fns", () => ({
  format: jest.fn(() => "08:00"),
}));

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-1",
    label: "Test Alarm",
    enabled: true,
    targetTimestampMs: new Date("2026-03-01T08:00:00Z").getTime(),
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 5,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

const cycleConfig = DEFAULT_SETTINGS.cycleConfig;

describe("AlarmCard", () => {
  const defaultProps = {
    cycleConfig,
    onToggle: jest.fn(),
    onPress: jest.fn(),
    onLongPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display alarm label and time", async () => {
    const alarm = makeAlarm();
    const { getByText } = await renderWithProviders(
      <AlarmCard alarm={alarm} {...defaultProps} />,
    );

    expect(getByText("Test Alarm")).toBeTruthy();
    expect(getByText("08:00")).toBeTruthy();
  });

  it("should show calendar badge when linkedCalendarEventId is set", async () => {
    const alarm = makeAlarm({ linkedCalendarEventId: "cal-event-123" });
    const { getByTestId } = await renderWithProviders(
      <AlarmCard alarm={alarm} {...defaultProps} />,
    );

    // Paper Icon renders with accessibilityElementsHidden, so include hidden elements
    expect(
      getByTestId(`alarm-calendar-badge-${alarm.id}`, {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it("should not show calendar badge when linkedCalendarEventId is null", async () => {
    const alarm = makeAlarm({ linkedCalendarEventId: null });
    const { queryByTestId } = await renderWithProviders(
      <AlarmCard alarm={alarm} {...defaultProps} />,
    );

    expect(
      queryByTestId(`alarm-calendar-badge-${alarm.id}`, {
        includeHiddenElements: true,
      }),
    ).toBeNull();
  });

  it("should call onToggle when switch is toggled", async () => {
    const onToggle = jest.fn();
    const alarm = makeAlarm();
    const { getByTestId } = await renderWithProviders(
      <AlarmCard alarm={alarm} {...defaultProps} onToggle={onToggle} />,
    );

    await fireEvent(getByTestId(`alarm-switch-${alarm.id}`), "valueChange");
    expect(onToggle).toHaveBeenCalledWith(alarm);
  });

  it("should apply opacity 0.6 when alarm is disabled", async () => {
    const alarm = makeAlarm({ enabled: false });
    const { getByTestId } = await renderWithProviders(
      <AlarmCard alarm={alarm} {...defaultProps} />,
    );

    // Paper Card applies style to the outer-layer container wrapper
    const outerLayer = getByTestId(
      `alarm-card-${alarm.id}-container-outer-layer`,
    );
    const flatStyle = Array.isArray(outerLayer.props.style)
      ? Object.assign({}, ...outerLayer.props.style.flat(Infinity))
      : outerLayer.props.style;
    expect(flatStyle?.opacity).toBe(0.6);
  });
});
