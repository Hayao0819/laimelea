import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { AlarmSoundPicker } from "../../../src/features/alarm/components/AlarmSoundPicker";
import { RingtoneService } from "../../../src/features/alarm/services/ringtoneService";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../src/features/alarm/services/ringtoneService", () => ({
  RingtoneService: {
    getAlarmRingtones: jest.fn().mockResolvedValue([
      { uri: "content://alarm1", title: "Alarm Tone 1" },
      { uri: "content://alarm2", title: "Alarm Tone 2" },
    ]),
    playPreview: jest.fn().mockResolvedValue(undefined),
    stopPreview: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGetAlarmRingtones = RingtoneService.getAlarmRingtones as jest.Mock;

async function renderWithPaper(ui: React.ReactElement) {
  const utils = await render(<PaperProvider>{ui}</PaperProvider>);
  await act(async () => {});
  return utils;
}

describe("AlarmSoundPicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAlarmRingtones.mockResolvedValue([
      { uri: "content://alarm1", title: "Alarm Tone 1" },
      { uri: "content://alarm2", title: "Alarm Tone 2" },
    ]);
  });

  it("should render dialog when visible", async () => {
    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri={null}
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    expect(getByTestId("sound-picker-dialog")).toBeTruthy();
  });

  it("should show default and silent options", async () => {
    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri={null}
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    expect(getByTestId("sound-option-default")).toBeTruthy();
    expect(getByTestId("sound-option-silent")).toBeTruthy();
  });

  it("should call onSoundChange with null when default is selected", async () => {
    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri="__silent__"
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    await fireEvent.press(getByTestId("sound-option-default"));
    expect(onSoundChange).toHaveBeenCalledWith(null);
  });

  it("should call onSoundChange with __silent__ when silent is selected", async () => {
    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByTestId } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri={null}
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    await fireEvent.press(getByTestId("sound-option-silent"));
    expect(onSoundChange).toHaveBeenCalledWith("__silent__");
  });

  it("should load and display ringtones from RingtoneService", async () => {
    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByText } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri={null}
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    await waitFor(() => {
      expect(getByText("Alarm Tone 1")).toBeTruthy();
      expect(getByText("Alarm Tone 2")).toBeTruthy();
    });
  });

  it("should call onSoundChange with ringtone uri when selected", async () => {
    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByText } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri={null}
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    await waitFor(() => {
      expect(getByText("Alarm Tone 1")).toBeTruthy();
    });

    await fireEvent.press(getByText("Alarm Tone 1"));
    expect(onSoundChange).toHaveBeenCalledWith("content://alarm1");
  });

  it("should show only default and silent when ringtone loading fails", async () => {
    mockGetAlarmRingtones.mockRejectedValue(new Error("Module not found"));

    const onSoundChange = jest.fn();
    const onDismiss = jest.fn();
    const { getByTestId, queryByText } = await renderWithPaper(
      <AlarmSoundPicker
        soundUri={null}
        onSoundChange={onSoundChange}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    // Wait for async load to settle
    await waitFor(() => {
      expect(getByTestId("sound-option-default")).toBeTruthy();
    });

    expect(getByTestId("sound-option-default")).toBeTruthy();
    expect(getByTestId("sound-option-silent")).toBeTruthy();
    expect(queryByText("Alarm Tone 1")).toBeNull();
  });
});
