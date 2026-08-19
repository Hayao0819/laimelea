export const DRIVE_REQUEST_TIMEOUT_MS = 30_000;
export const DRIVE_TRANSFER_TIMEOUT_MS = 5 * 60 * 1000;

function linkAbortSignals(
  controller: AbortController,
  callerSignal: AbortSignal | null | undefined,
): () => void {
  if (!callerSignal) return () => {};
  if (callerSignal.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  callerSignal.addEventListener("abort", onAbort, { once: true });
  return () => callerSignal.removeEventListener("abort", onAbort);
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs: number = DRIVE_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const unlinkAbortSignals = linkAbortSignals(controller, init?.signal);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    unlinkAbortSignals();
  }
}
