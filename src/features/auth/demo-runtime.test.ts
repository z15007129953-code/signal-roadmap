// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("demo route wiring", () => {
  it("imports all routes without secrets and fails safely when unconfigured", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    const start = await import("@/app/api/demo/start/route");
    const persona = await import("@/app/api/demo/persona/route");
    const cleanup = await import("@/app/api/cron/cleanup-demo/route");
    expect(start.runtime).toBe("nodejs");
    expect(persona.runtime).toBe("nodejs");
    expect(cleanup.runtime).toBe("nodejs");
    for (const handler of [start.POST, persona.POST, cleanup.GET]) {
      const response = await handler(
        new Request("https://signal.example/api/demo/start"),
      );
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("DATABASE_URL");
    }
  });
  it("enforces origin and cron authority through the real route without connecting to PostgreSQL", async () => {
    for (const [key, value] of Object.entries({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://local@127.0.0.1:1/signal",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "a".repeat(32),
      DEMO_COOKIE_SECRET: "b".repeat(32),
      CRON_SECRET: "c".repeat(32),
    }))
      vi.stubEnv(key, value);
    const { POST } = await import("@/app/api/demo/start/route");
    const { GET } = await import("@/app/api/cron/cleanup-demo/route");
    expect(
      (
        await POST(
          new Request("http://localhost:3000/api/demo/start", {
            method: "POST",
            headers: { origin: "https://attacker.example" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await GET(new Request("http://localhost:3000/api/cron/cleanup-demo")))
        .status,
    ).toBe(401);
  });
});
