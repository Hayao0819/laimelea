/**
 * Decode the payload section of a JWT (id_token) without signature verification.
 * Signature verification is a server-side responsibility.
 */
export function decodeIdTokenPayload(idToken: string): Record<string, unknown> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const json = atob(padded);
  return JSON.parse(json);
}

/**
 * Extract email from a Google id_token.
 */
export function extractEmailFromIdToken(idToken: string): string {
  const payload = decodeIdTokenPayload(idToken);
  const email = payload.email;
  if (typeof email !== "string") {
    throw new Error("No email found in id_token");
  }
  return email;
}
