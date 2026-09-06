// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createDemoHandlers } from "./demo-http";
import type { DemoRepository } from "./demo-session";
import { createDemoToken, signDemoToken } from "./demo-token";

const secret = "s".repeat(32);
function setup() {
  const repository: DemoRepository = {
    create: vi.fn(async () => ({ workspaceId: "id", slug: "demo-id" })),
    findPersona: vi.fn(async () => ({
      workspaceId: "id",
      slug: "demo-id",
      expiresAt: new Date(Date.now() + 60000),
    })),
    deleteExpiredBatch: vi.fn(async () => 3),
  };
  return {
    repository,
    handlers: createDemoHandlers({
      repository,
      secret,
      secure: true,
      appUrl: "https://signal.example",
      cronSecret: secret,
    }),
  };
}
const request = (path: string, init: RequestInit = {}) =>
  new Request(`https://signal.example${path}`, init);
describe("demo HTTP boundary", () => {
  it("bounds switch payloads even when content length is omitted", async () => {
    const { handlers, repository } = setup();
    const response = await handlers.switchPersona(
      request("/api/demo/persona", {
        method: "POST",
        headers: {
          origin: "https://signal.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ persona: "member", extra: "x".repeat(1000) }),
      }),
    );
    expect(response.status).toBe(422);
    expect(repository.findPersona).not.toHaveBeenCalled();
  });
  it("creates via same-origin POST, returns public data and sets an HTTP-only cookie", async () => {
    const { handlers } = setup();
    const response = await handlers.start(
      request("/api/demo/start", {
        method: "POST",
        headers: { origin: "https://signal.example" },
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      value: { workspaceId: "id", slug: "demo-id" },
    });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([null, "https://evil.example", "null"])(
    "rejects untrusted origin %s before writes",
    async (origin) => {
      const { handlers, repository } = setup();
      const response = await handlers.start(
        request("/api/demo/start", {
          method: "POST",
          headers: origin ? { origin } : {},
        }),
      );
      expect(response.status).toBe(403);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it("never permits GET to create a workspace", async () => {
    const { handlers, repository } = setup();
    expect(
      (
        await handlers.start(
          request("/api/demo/start", {
            headers: { origin: "https://signal.example" },
          }),
        )
      ).status,
    ).toBe(405);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("switches only the bearer session selected by its signed cookie", async () => {
    const { handlers } = setup();
    const cookie = signDemoToken(createDemoToken(), "member", secret);
    const response = await handlers.switchPersona(
      request("/api/demo/persona", {
        method: "POST",
        headers: {
          origin: "https://signal.example",
          "content-type": "application/json",
          cookie: `signal-demo=${cookie}`,
        },
        body: JSON.stringify({ persona: "moderator" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("v1.moderator.");
  });
  it.each([
    "{}",
    '{"persona":"owner"}',
    '{"persona":"member","workspaceId":"other"}',
    "{",
  ])("rejects invalid switch payload %s", async (body) => {
    const { handlers, repository } = setup();
    const response = await handlers.switchPersona(
      request("/api/demo/persona", {
        method: "POST",
        headers: {
          origin: "https://signal.example",
          "content-type": "application/json",
        },
        body,
      }),
    );
    expect(response.status).toBe(422);
    expect(repository.findPersona).not.toHaveBeenCalled();
  });
  it.each([null, "Bearer wrong", "Basic anything"])(
    "rejects unauthorized cleanup %s",
    async (authorization) => {
      const { handlers, repository } = setup();
      expect(
        (
          await handlers.cleanup(
            request("/api/cron/cleanup-demo", {
              headers: authorization ? { authorization } : {},
            }),
          )
        ).status,
      ).toBe(401);
      expect(repository.deleteExpiredBatch).not.toHaveBeenCalled();
    },
  );
  it("returns only an aggregate count for authorized cleanup", async () => {
    const { handlers } = setup();
    const response = await handlers.cleanup(
      request("/api/cron/cleanup-demo", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(await response.json()).toEqual({ ok: true, value: { deleted: 3 } });
  });
  it("redacts database failures", async () => {
    const { handlers, repository } = setup();
    vi.mocked(repository.create).mockRejectedValue(
      new Error("private database credentials"),
    );
    const response = await handlers.start(
      request("/api/demo/start", {
        method: "POST",
        headers: { origin: "https://signal.example" },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database credentials");
  });
});
