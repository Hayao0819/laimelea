import { act,fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { BulkAlarmForm } from "../../../src/features/alarm/components/BulkAlarmForm";
import type { Alarm } from "../../../src/models/Alarm";
import type { DismissalMethod } from "../../../src/models/Settings";

jest.mock("react-native-shake", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

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

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Morning",
    enabled: true,
    targetTimestampMs: Date.now() + 3600000,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 15,
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

interface FormProps {
  fromTime?: { hours: number; minutes: number };
  toTime?: { hours: number; minutes: number };
  timeSystem?: "custom" | "24h";
  intervalMinutes?: string;
  dismissalMethod?: DismissalMethod;
  label?: string;
  cycleLengthMinutes?: number;
  previewAlarms?: Alarm[];
  warning?: string | null;
  existingAlarmCount?: number;
  onFromTimeChange?: (v: { hours: number; minutes: number }) => void;
  onToTimeChange?: (v: { hours: number; minutes: number }) => void;
  onTimeSystemChange?: (v: "custom" | "24h") => void;
  onIntervalChange?: (v: string) => void;
  onDismissalMethodChange?: (v: DismissalMethod) => void;
  onLabelChange?: (v: string) => void;
}

function renderForm(overrides: FormProps = {}) {
  const defaultProps = {
    fromTime: { hours: 7, minutes: 0 },
    toTime: { hours: 9, minutes: 0 },
    timeSystem: "24h" as const,
    intervalMinutes: "30",
    dismissalMethod: "simple" as DismissalMethod,
    label: "",
    cycleLengthMinutes: 1560,
    previewAlarms: [] as Alarm[],
    warning: null,
    existingAlarmCount: 0,
    onFromTimeChange: jest.fn(),
    onToTimeChange: jest.fn(),
    onTimeSystemChange: jest.fn(),
    onIntervalChange: jest.fn(),
    onDismissalMethodChange: jest.fn(),
    onLabelChange: jest.fn(),
    ...overrides,
  };

  const utils = render(
    <PaperProvider>
      <BulkAlarmForm {...defaultProps} />
    </PaperProvider>,
  );

  return { ...utils, props: defaultProps };
}

describe("BulkAlarmForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render with interval input", async () => {
    const { getByTestId } = await renderForm();
    expect(getByTestId("interval-input")).toBeTruthy();
  });

  it("should render label input", async () => {
    const { getByTestId } = await renderForm();
    expect(getByTestId("bulk-label-input")).toBeTruthy();
  });

  it("should render from/to time pickers", async () => {
    const { getAllByTestId } = await renderForm();
    const pickers = getAllByTestId("alarm-time-picker");
    expect(pickers).toHaveLength(2);
  });

  it("should render time system segmented buttons", async () => {
    const { getByText } = await renderForm();
    expect(getByText("clock.customTime")).toBeTruthy();
    expect(getByText("clock.realTime")).toBeTruthy();
  });

  it("should render dismissal method item", async () => {
    const { getByTestId } = await renderForm();
    expect(getByTestId("bulk-dismissal-item")).toBeTruthy();
  });

  it("should show dismissal dialog when dismissal item pressed", async () => {
    const { getByTestId } = await renderForm();

    await act(async () => {
      fireEvent.press(getByTestId("bulk-dismissal-item"));
    });

    expect(getByTestId("bulk-dismissal-dialog")).toBeTruthy();
  });

  it("should render all dismissal strategy options in dialog", async () => {
    const { getByTestId } = await renderForm();

    await act(async () => {
      fireEvent.press(getByTestId("bulk-dismissal-item"));
    });

    expect(getByTestId("bulk-dismissal-option-simple")).toBeTruthy();
    expect(getByTestId("bulk-dismissal-option-shake")).toBeTruthy();
    expect(getByTestId("bulk-dismissal-option-math")).toBeTruthy();
  });

  it("should call onDismissalMethodChange when radio button selected and close dialog", async () => {
    jest.useFakeTimers();
    const onDismissalMethodChange = jest.fn();
    const { getByTestId, queryByTestId } = await renderForm({
      onDismissalMethodChange,
    });

    await act(async () => {
      fireEvent.press(getByTestId("bulk-dismissal-item"));
    });

    expect(getByTestId("bulk-dismissal-dialog")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("bulk-dismissal-option-math"));
    });

    expect(onDismissalMethodChange).toHaveBeenCalledWith("math");

    // Advance timers to allow Dialog exit animation to complete
    await act(async () => {
      jest.runAllTimers();
    });

    // After animation completes, Dialog should be removed from tree
    expect(queryByTestId("bulk-dismissal-dialog")).toBeNull();
    jest.useRealTimers();
  });

  it("should show preview with alarm count when previewAlarms has items", async () => {
    const alarms = [
      makeAlarm({ id: "a1" }),
      makeAlarm({ id: "a2" }),
      makeAlarm({ id: "a3" }),
    ];
    const { getByText } = await renderForm({ previewAlarms: alarms });

    expect(getByText('alarm.bulkPreviewCount:{"count":3}')).toBeTruthy();
  });

  it('should show "alarm.bulkNoAlarms" when previewAlarms is empty', async () => {
    const { getByText } = await renderForm({ previewAlarms: [] });
    expect(getByText("alarm.bulkNoAlarms")).toBeTruthy();
  });

  it("should show preview time chips for each alarm", async () => {
    const alarms = [
      makeAlarm({
        id: "a1",
        targetTimestampMs: new Date("2026-02-27T07:00:00").getTime(),
      }),
      makeAlarm({
        id: "a2",
        targetTimestampMs: new Date("2026-02-27T07:30:00").getTime(),
      }),
    ];
    const { getAllByText } = await renderForm({ previewAlarms: alarms });

    // Each alarm renders a Chip with formatted time
    // The formatAlarmTime function returns HH:MM format
    expect(getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(2);
  });

  it("should show warning banner when warning prop is set", async () => {
    const { getByText } = await renderForm({
      warning: "alarm.bulkWarningLimit",
      previewAlarms: [makeAlarm()],
      existingAlarmCount: 48,
    });

    expect(getByText(/alarm\.bulkWarningLimit/)).toBeTruthy();
  });

  it("should not show warning banner when warning is null", async () => {
    const { queryByText } = await renderForm({
      warning: null,
    });

    expect(queryByText(/alarm\.bulkWarningLimit/)).toBeNull();
  });

  it("should call onIntervalChange when interval input changes", async () => {
    const onIntervalChange = jest.fn();
    const { getByTestId } = await renderForm({ onIntervalChange });

    await act(async () => {
      fireEvent.changeText(getByTestId("interval-input"), "15");
    });

    expect(onIntervalChange).toHaveBeenCalledWith("15");
  });

  it("should call onLabelChange when label input changes", async () => {
    const onLabelChange = jest.fn();
    const { getByTestId } = await renderForm({ onLabelChange });

    await act(async () => {
      fireEvent.changeText(getByTestId("bulk-label-input"), "Wake up");
    });

    expect(onLabelChange).toHaveBeenCalledWith("Wake up");
  });
});
