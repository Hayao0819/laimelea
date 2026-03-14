import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

const mockIsIgnoring = jest.fn<Promise<boolean>, []>();
const mockRequest = jest.fn<Promise<boolean>, []>();

jest.mock("../../../../src/core/platform/batteryOptimization", () => ({
  isIgnoringBatteryOptimizations: (...args: unknown[]) =>
    mockIsIgnoring(...(args as [])),
  requestIgnoreBatteryOptimizations: (...args: unknown[]) =>
    mockRequest(...(args as [])),
}));

import { useBatteryOptimization } from "../../../../src/features/settings/hooks/useBatteryOptimization";

const mockRemove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockIsIgnoring.mockResolvedValue(false);
  mockRequest.mockResolvedValue(true);
  jest
    .spyOn(AppState, "addEventListener")
    .mockReturnValue({ remove: mockRemove } as ReturnType<
      typeof AppState.addEventListener
    >);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useBatteryOptimization", () => {
  it("starts with null and resolves to the platform value", async () => {
    mockIsIgnoring.mockResolvedValue(true);

    const { result } = renderHook(() => useBatteryOptimization());

    // Initially null
    expect(result.current.ignored).toBeNull();

    // Flush async state update from useEffect
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.ignored).toBe(true);
    });
  });

  it("resolves to false when not excluded", async () => {
    mockIsIgnoring.mockResolvedValue(false);

    const { result } = renderHook(() => useBatteryOptimization());

    await waitFor(() => {
      expect(result.current.ignored).toBe(false);
    });
  });

  it("requestExclusion calls the platform API and rechecks", async () => {
    mockIsIgnoring.mockResolvedValue(false);
    mockRequest.mockResolvedValue(true);

    const { result } = renderHook(() => useBatteryOptimization());

    await waitFor(() => {
      expect(result.current.ignored).toBe(false);
    });

    // After requesting, mock returns true
    mockIsIgnoring.mockResolvedValue(true);

    await act(async () => {
      await result.current.requestExclusion();
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.ignored).toBe(true);
    });
  });

  it("registers an AppState listener on mount", async () => {
    const { result } = renderHook(() => useBatteryOptimization());

    // Flush the async useEffect that checks battery status
    await waitFor(() => {
      expect(result.current.ignored).not.toBeNull();
    });

    const addListenerMock = AppState.addEventListener as jest.Mock;
    const call = addListenerMock.mock.calls.find(
      (c: unknown[]) => c[0] === "change",
    );
    expect(call).toBeTruthy();
  });

  it("rechecks status when app returns to active", async () => {
    mockIsIgnoring.mockResolvedValue(false);

    const { result } = renderHook(() => useBatteryOptimization());

    await waitFor(() => {
      expect(result.current.ignored).toBe(false);
    });

    const addListenerMock = AppState.addEventListener as jest.Mock;
    const call = addListenerMock.mock.calls.find(
      (c: unknown[]) => c[0] === "change",
    );
    const callback = call![1] as (state: string) => void;

    mockIsIgnoring.mockResolvedValue(true);

    await act(async () => {
      callback("active");
    });

    await waitFor(() => {
      expect(result.current.ignored).toBe(true);
    });
  });

  it("does not recheck when app goes to background", async () => {
    renderHook(() => useBatteryOptimization());

    await waitFor(() => {
      expect(mockIsIgnoring).toHaveBeenCalled();
    });
    mockIsIgnoring.mockClear();

    const addListenerMock = AppState.addEventListener as jest.Mock;
    const call = addListenerMock.mock.calls.find(
      (c: unknown[]) => c[0] === "change",
    );
    const callback = call![1] as (state: string) => void;

    await act(async () => {
      callback("background");
    });

    expect(mockIsIgnoring).not.toHaveBeenCalled();
  });
});
