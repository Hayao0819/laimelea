import { act, renderHook } from "@testing-library/react-native";

import { useSnackbar } from "../../../../src/features/settings/hooks/useSnackbar";

describe("useSnackbar", () => {
  it("should start with invisible state", () => {
    const { result } = renderHook(() => useSnackbar());

    expect(result.current.visible).toBe(false);
    expect(result.current.message).toBe("");
  });

  it("should set visible and message on show()", () => {
    const { result } = renderHook(() => useSnackbar());

    act(() => {
      result.current.show("Settings saved");
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.message).toBe("Settings saved");
  });

  it("should hide on dismiss()", () => {
    const { result } = renderHook(() => useSnackbar());

    act(() => {
      result.current.show("Settings saved");
    });

    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
    // message is retained after dismiss (only visible changes)
    expect(result.current.message).toBe("Settings saved");
  });

  it("should update message when show() called again", () => {
    const { result } = renderHook(() => useSnackbar());

    act(() => {
      result.current.show("First message");
    });

    expect(result.current.message).toBe("First message");
    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.show("Second message");
    });

    expect(result.current.message).toBe("Second message");
    expect(result.current.visible).toBe(true);
  });

  it("should allow show() after dismiss()", () => {
    const { result } = renderHook(() => useSnackbar());

    act(() => {
      result.current.show("First");
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);

    act(() => {
      result.current.show("Second");
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.message).toBe("Second");
  });
});
