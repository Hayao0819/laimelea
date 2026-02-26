import {
  decodeIdTokenPayload,
  extractEmailFromIdToken,
} from "../../../../src/core/platform/aosp/tokenUtils";

function encodeBase64Url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  return btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/[=]+$/, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = encodeBase64Url({ alg: "RS256", typ: "JWT" });
  const body = encodeBase64Url(payload);
  const signature = "fake-signature";
  return `${header}.${body}.${signature}`;
}

describe("decodeIdTokenPayload", () => {
  it("should decode a valid JWT payload", () => {
    const payload = { sub: "123", email: "test@example.com", name: "Test" };
    const jwt = makeJwt(payload);
    const decoded = decodeIdTokenPayload(jwt);
    expect(decoded).toEqual(payload);
  });

  it("should throw on invalid JWT format (no dots)", () => {
    expect(() => decodeIdTokenPayload("not-a-jwt")).toThrow(
      "Invalid JWT format",
    );
  });

  it("should throw on invalid JWT format (one dot)", () => {
    expect(() => decodeIdTokenPayload("header.payload")).toThrow(
      "Invalid JWT format",
    );
  });
});

describe("extractEmailFromIdToken", () => {
  it("should extract email from id_token", () => {
    const jwt = makeJwt({ email: "user@gmail.com", sub: "456" });
    expect(extractEmailFromIdToken(jwt)).toBe("user@gmail.com");
  });

  it("should throw when email is missing", () => {
    const jwt = makeJwt({ sub: "789" });
    expect(() => extractEmailFromIdToken(jwt)).toThrow(
      "No email found in id_token",
    );
  });

  it("should throw when email is not a string", () => {
    const jwt = makeJwt({ email: 123, sub: "000" });
    expect(() => extractEmailFromIdToken(jwt)).toThrow(
      "No email found in id_token",
    );
  });
});
