// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createDemoSession,
  switchDemoPersona,
  cleanupDemoSessions,
  demoQuota,
  type DemoRepository,
} from "./demo-session";
import { hashDemoToken, verifyDemoToken } from "./demo-token";

const now = new Date("2026-09-06T00:00:00Z");
const secret = "s".repeat(32);
function repository(): DemoRepository {
  return {
    create: vi.fn(async () => ({
      workspaceId: "workspace",
      slug: "demo-example",
    })),
    findPersona: vi.fn(async () => ({
      workspaceId: "workspace",
      slug: "demo-example",
      expiresAt: new Date(now.getTime() + 86400000),
    })),
    deleteExpiredBatch: vi.fn(async () => 0),
  };
}
describe("demo lifecycle", () => {
  it("creates a 24-hour session, persists no bearer and sets a private cookie", async () => {
    const store = repository();
    const result = await createDemoSession({
      repository: store,
      secret,
      now,
      secure: true,
    });
    const credential = verifyDemoToken(result.cookie.value, secret)!;
    expect(credential.persona).toBe("member");
    expect(store.create).toHaveBeenCalledWith({
      tokenHash: hashDemoToken(credential.token),
      expiresAt: new Date("2026-09-07T00:00:00Z"),
    });
    expect(JSON.stringify(vi.mocked(store.create).mock.calls)).not.toContain(
      credential.token,
    );
    expect(result.cookie).toMatchObject({
      name: "signal-demo",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date("2026-09-07T00:00:00Z"),
    });
    expect(result.workspace).toEqual({
      workspaceId: "workspace",
      slug: "demo-example",
    });
    expect(demoQuota).toEqual({
      feedback: 30,
      comments: 100,
      changelogEntries: 10,
      requestsPerMinute: 60,
    });
  });
  it("switches only a persisted persona without extending expiry", async () => {
    const store = repository();
    const initial = await createDemoSession({
      repository: store,
      secret,
      now,
      secure: false,
    });
    const result = await switchDemoPersona(initial.cookie.value, "moderator", {
      repository: store,
      secret,
      now,
      secure: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(verifyDemoToken(result.value.cookie.value, secret)).toEqual({
      ...verifyDemoToken(initial.cookie.value, secret),
      persona: "moderator",
    });
    expect(result.value.cookie.expires).toEqual(initial.cookie.expires);
    expect(store.findPersona).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "moderator",
    );
  });
  it("rejects forged credentials before database access", async () => {
    const store = repository();
    expect(
      await switchDemoPersona("forged", "member", {
        repository: store,
        secret,
        now,
        secure: false,
      }),
    ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(store.findPersona).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin", "", null])(
    "rejects unapproved persona %s",
    async (persona) => {
      const store = repository();
      expect(
        await switchDemoPersona("irrelevant", persona, {
          repository: store,
          secret,
          now,
          secure: false,
        }),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      expect(store.findPersona).not.toHaveBeenCalled();
    },
  );
  it.each([null, { workspaceId: "workspace", slug: "demo", expiresAt: now }])(
    "rejects missing or expired sessions",
    async (record) => {
      const store = repository();
      const initial = await createDemoSession({
        repository: store,
        secret,
        now,
        secure: false,
      });
      vi.mocked(store.findPersona).mockResolvedValue(record);
      expect(
        await switchDemoPersona(initial.cookie.value, "moderator", {
          repository: store,
          secret,
          now,
          secure: false,
        }),
      ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
    },
  );
  it("never writes data when signing configuration is invalid", async () => {
    const store = repository();
    await expect(
      createDemoSession({
        repository: store,
        secret: "short",
        now,
        secure: true,
      }),
    ).rejects.toThrow();
    expect(store.create).not.toHaveBeenCalled();
  });
  it("cleans one bounded batch per invocation and allows repeat runs", async () => {
    const store = repository();
    vi.mocked(store.deleteExpiredBatch)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0);
    expect(await cleanupDemoSessions(store, now)).toEqual({ deleted: 100 });
    expect(await cleanupDemoSessions(store, now)).toEqual({ deleted: 0 });
    expect(store.deleteExpiredBatch).toHaveBeenCalledTimes(2);
    expect(store.deleteExpiredBatch).toHaveBeenCalledWith(now, 100);
  });
});
