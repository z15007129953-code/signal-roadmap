import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export type DemoPersona = "member" | "moderator";
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const cookiePattern =
  /^v1\.(member|moderator)\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

export function createDemoToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDemoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signature(value: string, secret: string): string {
  if (secret.length < 32) throw new Error("Demo signing secret is too short");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signDemoToken(
  token: string,
  persona: DemoPersona,
  secret: string,
): string {
  if (
    !bearerPattern.test(token) ||
    !["member", "moderator"].includes(persona)
  ) {
    throw new Error("Invalid demo credential");
  }
  const payload = `v1.${persona}.${token}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyDemoToken(
  cookie: string,
  secret: string,
): { token: string; persona: DemoPersona } | null {
  if (cookie.length > 150) return null;
  const match = cookiePattern.exec(cookie);
  if (!match) return null;
  const [, persona, token, supplied] = match;
  const expected = signature(`v1.${persona}.${token}`, secret);
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return null;
  return { token, persona: persona as DemoPersona };
}
