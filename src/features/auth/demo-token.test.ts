// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createDemoToken,
  hashDemoToken,
  signDemoToken,
  verifyDemoToken,
} from "./demo-token";

const secret = "s".repeat(32);
describe("signed demo credentials", () => {
  it("creates independent 256-bit bearer tokens and stores only a hash", () => {
    const first = createDemoToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createDemoToken()).not.toBe(first);
    expect(hashDemoToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDemoToken(first)).not.toContain(first);
    expect(hashDemoToken(first)).toBe(hashDemoToken(first));
  });
  it("round trips signed credentials and the server-selected persona", () => {
    const token = createDemoToken();
    const cookie = signDemoToken(token, "member", secret);
    expect(verifyDemoToken(cookie, secret)).toEqual({
      token,
      persona: "member",
    });
    expect(
      verifyDemoToken(signDemoToken(token, "moderator", secret), secret)
        ?.persona,
    ).toBe("moderator");
  });
  it("rejects tampering, another secret, malformed and overlong values", () => {
    const cookie = signDemoToken(createDemoToken(), "member", secret);
    for (const invalid of [
      "",
      cookie.replace("member", "moderator"),
      cookie + "=",
      cookie + ".extra",
      "a".repeat(4096),
      "v1.owner.token.signature",
    ]) {
      expect(verifyDemoToken(invalid, secret)).toBeNull();
    }
    expect(verifyDemoToken(cookie, "t".repeat(32))).toBeNull();
  });
  it("never signs an arbitrary role or malformed token", () => {
    expect(() =>
      signDemoToken(createDemoToken(), "owner" as "member", secret),
    ).toThrow();
    expect(() => signDemoToken("short", "member", secret)).toThrow();
    expect(() => signDemoToken(createDemoToken(), "member", "short")).toThrow();
  });
});
