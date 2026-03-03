import NetInfo from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-native";

import { useNetworkStatus } from "../../src/hooks/useNetworkStatus";

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

describe("useNetworkStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return initial isConnected as null before listener fires", () => {
    // Override mock to NOT call callback immediately
    mockAddEventListener.mockImplementation(() => {
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isConnected).toBeNull();
  });

  it("should return true when network is connected", () => {
    mockAddEventListener.mockImplementation((callback) => {
      callback({ isConnected: true, isInternetReachable: true });
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isConnected).toBe(true);
  });

  it("should return false when network is disconnected", () => {
    mockAddEventListener.mockImplementation((callback) => {
      callback({ isConnected: false, isInternetReachable: false });
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isConnected).toBe(false);
  });

  it("should update when connection state changes", () => {
    let capturedCallback: (state: {
      isConnected: boolean;
      isInternetReachable: boolean;
    }) => void;

    mockAddEventListener.mockImplementation((callback) => {
      capturedCallback = callback;
      callback({ isConnected: true, isInternetReachable: true });
      return () => {};
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isConnected).toBe(true);

    act(() => {
      capturedCallback({ isConnected: false, isInternetReachable: false });
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("should unsubscribe on unmount", () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockImplementation((callback) => {
      callback({ isConnected: true, isInternetReachable: true });
      return unsubscribe;
    });

    const { unmount } = renderHook(() => useNetworkStatus());
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
