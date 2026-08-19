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
  return JSON.parse(atob(padded));
}

export function extractEmailFromIdToken(idToken: string): string {
  const email = decodeIdTokenPayload(idToken).email;
  if (typeof email !== "string") {
    throw new Error("No email found in id_token");
  }
  return email;
}
