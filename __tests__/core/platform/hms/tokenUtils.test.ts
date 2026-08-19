import {
  decodeIdTokenPayload,
  extractEmailFromIdToken,
} from "../../../../src/core/platform/hms/tokenUtils";

function encodeBase64Url(value: Record<string, unknown>): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/[=]+$/, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${encodeBase64Url({ alg: "RS256", typ: "JWT" })}.${encodeBase64Url(payload)}.fake-signature`;
}

describe("decodeIdTokenPayload", () => {
  it("decodes a JWT payload", () => {
    const payload = { sub: "123", email: "test@example.com" };
    expect(decodeIdTokenPayload(makeJwt(payload))).toEqual(payload);
  });

  it.each(["not-a-jwt", "header.payload"])(
    "rejects an invalid JWT: %s",
    (token) => {
      expect(() => decodeIdTokenPayload(token)).toThrow("Invalid JWT format");
    },
  );
});

describe("extractEmailFromIdToken", () => {
  it("extracts the email claim", () => {
    expect(extractEmailFromIdToken(makeJwt({ email: "user@gmail.com" }))).toBe(
      "user@gmail.com",
    );
  });

  it.each([{ sub: "789" }, { email: 123 }])(
    "rejects a missing or invalid email claim",
    (payload) => {
      expect(() => extractEmailFromIdToken(makeJwt(payload))).toThrow(
        "No email found in id_token",
      );
    },
  );
});
