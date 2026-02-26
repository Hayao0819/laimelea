import { GradualVolumeManager } from "../../../../src/features/alarm/services/gradualVolumeManager";

describe("GradualVolumeManager", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should start at volume 0 and increase over time", () => {
    const manager = new GradualVolumeManager(10); // 10 seconds
    const onVolumeChange = jest.fn();

    manager.start(onVolumeChange);

    // Initial call with 0
    expect(onVolumeChange).toHaveBeenCalledWith(0);
    expect(manager.getCurrentVolume()).toBe(0);

    // After 1 second (2 x 500ms steps)
    jest.advanceTimersByTime(1000);
    expect(manager.getCurrentVolume()).toBeCloseTo(0.1);

    manager.stop();
  });

  it("should reach volume 1.0 after full duration", () => {
    const manager = new GradualVolumeManager(5); // 5 seconds
    const onVolumeChange = jest.fn();

    manager.start(onVolumeChange);
    jest.advanceTimersByTime(5000);

    expect(manager.getCurrentVolume()).toBe(1.0);
    // Should have been called with 1.0
    expect(onVolumeChange).toHaveBeenLastCalledWith(1.0);

    manager.stop();
  });

  it("should immediately set max volume when durationSec is 0", () => {
    const manager = new GradualVolumeManager(0);
    const onVolumeChange = jest.fn();

    manager.start(onVolumeChange);

    expect(onVolumeChange).toHaveBeenCalledWith(1.0);
    expect(manager.getCurrentVolume()).toBe(1.0);
  });

  it("should stop the interval timer", () => {
    const manager = new GradualVolumeManager(10);
    const onVolumeChange = jest.fn();

    manager.start(onVolumeChange);
    jest.advanceTimersByTime(1000);
    const volumeAtStop = manager.getCurrentVolume();

    manager.stop();
    jest.advanceTimersByTime(5000);

    // Volume should not change after stop
    expect(manager.getCurrentVolume()).toBe(volumeAtStop);
  });

  it("should auto-stop when reaching max volume", () => {
    const clearSpy = jest.spyOn(globalThis, "clearInterval");
    const manager = new GradualVolumeManager(2); // 2 seconds
    const onVolumeChange = jest.fn();

    manager.start(onVolumeChange);
    jest.advanceTimersByTime(2000);

    expect(manager.getCurrentVolume()).toBe(1.0);
    // clearInterval should have been called (auto-stop)
    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
  });
});
