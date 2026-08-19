import {
  DRIVE_REQUEST_TIMEOUT_MS,
  DRIVE_TRANSFER_TIMEOUT_MS,
  fetchWithTimeout,
} from "../../../src/core/drive/fetchWithTimeout";

describe("fetchWithTimeout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("aborts a request that exceeds the deadline", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const request = fetchWithTimeout("https://example.com");
    const rejection = request.then(
      () => null,
      (error: unknown) => error,
    );
    await jest.advanceTimersByTimeAsync(DRIVE_REQUEST_TIMEOUT_MS);

    expect(await rejection).toEqual(new Error("aborted"));
  });

  it("clears the timeout after a successful response", async () => {
    jest.useFakeTimers();
    const response = { ok: true } as Response;
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(fetchWithTimeout("https://example.com")).resolves.toBe(
      response,
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it("honors a caller-supplied timeoutMs instead of the default", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const request = fetchWithTimeout(
      "https://example.com",
      undefined,
      DRIVE_TRANSFER_TIMEOUT_MS,
    );
    const rejection = request.then(
      () => null,
      (error: unknown) => error,
    );

    await jest.advanceTimersByTimeAsync(DRIVE_REQUEST_TIMEOUT_MS);
    expect(await Promise.race([rejection, Promise.resolve("pending")])).toBe(
      "pending",
    );

    await jest.advanceTimersByTimeAsync(
      DRIVE_TRANSFER_TIMEOUT_MS - DRIVE_REQUEST_TIMEOUT_MS,
    );
    expect(await rejection).toEqual(new Error("aborted"));
  });

  it("aborts when a caller-supplied signal aborts before the deadline", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const callerController = new AbortController();
    const request = fetchWithTimeout("https://example.com", {
      signal: callerController.signal,
    });
    const rejection = request.then(
      () => null,
      (error: unknown) => error,
    );

    callerController.abort();

    expect(await rejection).toEqual(new Error("aborted"));
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not drop a caller-supplied signal that is already aborted", async () => {
    global.fetch = jest.fn(
      (
        _input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const callerController = new AbortController();
    callerController.abort();

    await expect(
      fetchWithTimeout("https://example.com", {
        signal: callerController.signal,
      }),
    ).rejects.toEqual(new Error("aborted"));
  });

  it("removes the caller-signal abort listener once the request settles", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const mockSignal = {
      aborted: false,
      addEventListener,
      removeEventListener,
    } as unknown as AbortSignal;

    await fetchWithTimeout("https://example.com", { signal: mockSignal });

    expect(addEventListener).toHaveBeenCalledTimes(1);
    const [, listener] = addEventListener.mock.calls[0] as [string, () => void];
    expect(removeEventListener).toHaveBeenCalledWith("abort", listener);
  });
});
