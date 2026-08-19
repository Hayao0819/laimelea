const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockGetCurrentRoute = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockSetAlarmWindowActive = jest.fn(() => Promise.resolve());
let mockIsReadyValue = true;

jest.mock("@react-navigation/native", () => ({
  createNavigationContainerRef: () => ({
    isReady: () => mockIsReadyValue,
    navigate: mockNavigate,
    goBack: mockGoBack,
    getCurrentRoute: mockGetCurrentRoute,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock("../../src/features/alarm/services/ringtoneService", () => ({
  setAlarmWindowActive: mockSetAlarmWindowActive,
}));

const {
  completeAlarmFiringNavigation,
  enqueueAlarmFiringNavigation,
  resetAlarmFiringNavigation,
} = require("../../src/app/navigation");

describe("alarm firing navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsReadyValue = true;
    resetAlarmFiringNavigation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetAlarmFiringNavigation();
    jest.useRealTimers();
  });

  it("shows simultaneous alarms one at a time", () => {
    enqueueAlarmFiringNavigation("alarm-a");
    enqueueAlarmFiringNavigation("alarm-b");

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
      alarmId: "alarm-a",
    });

    mockGetCurrentRoute.mockReturnValue({
      name: "AlarmFiring",
      params: { alarmId: "alarm-a" },
    });
    completeAlarmFiringNavigation("alarm-a");
    jest.runOnlyPendingTimers();

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenLastCalledWith("AlarmFiring", {
      alarmId: "alarm-b",
    });
  });

  it("clears lock-screen visibility after the last alarm", () => {
    enqueueAlarmFiringNavigation("alarm-a");
    mockGetCurrentRoute.mockReturnValue({
      name: "AlarmFiring",
      params: { alarmId: "alarm-a" },
    });

    completeAlarmFiringNavigation("alarm-a");

    expect(mockSetAlarmWindowActive).toHaveBeenLastCalledWith(false);
  });

  it("removes a stopped alarm that is still queued", () => {
    enqueueAlarmFiringNavigation("alarm-a");
    enqueueAlarmFiringNavigation("alarm-b");
    completeAlarmFiringNavigation("alarm-b");
    mockGetCurrentRoute.mockReturnValue({
      name: "AlarmFiring",
      params: { alarmId: "alarm-a" },
    });

    completeAlarmFiringNavigation("alarm-a");
    jest.runOnlyPendingTimers();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockSetAlarmWindowActive).toHaveBeenLastCalledWith(false);
  });

  it("retries navigation once the navigator becomes ready", () => {
    mockIsReadyValue = false;
    enqueueAlarmFiringNavigation("alarm-a");
    expect(mockNavigate).not.toHaveBeenCalled();

    mockIsReadyValue = true;
    jest.advanceTimersByTime(100);

    expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
      alarmId: "alarm-a",
    });
  });

  it("clears a pending retry timer on reset, allowing a fresh retry to be scheduled", () => {
    mockIsReadyValue = false;
    enqueueAlarmFiringNavigation("alarm-a");
    resetAlarmFiringNavigation();

    enqueueAlarmFiringNavigation("alarm-b");
    mockIsReadyValue = true;
    jest.advanceTimersByTime(100);

    expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
      alarmId: "alarm-b",
    });
  });

  it("is idempotent when completing the same alarm twice", () => {
    enqueueAlarmFiringNavigation("alarm-a");
    mockGetCurrentRoute.mockReturnValue({
      name: "AlarmFiring",
      params: { alarmId: "alarm-a" },
    });

    completeAlarmFiringNavigation("alarm-a");
    jest.runOnlyPendingTimers();
    mockGoBack.mockClear();
    mockSetAlarmWindowActive.mockClear();

    completeAlarmFiringNavigation("alarm-a");

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockSetAlarmWindowActive).not.toHaveBeenCalled();
  });

  it("ignores enqueueing an id that is already active", () => {
    enqueueAlarmFiringNavigation("alarm-a");
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    enqueueAlarmFiringNavigation("alarm-a");

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
