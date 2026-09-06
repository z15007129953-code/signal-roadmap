// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { resolveActor, type IdentityRepository } from "./resolve-actor";
import { createDemoToken, signDemoToken } from "./demo-token";

const secret = "s".repeat(32);
const token = createDemoToken();
const now = new Date("2026-09-06T00:00:00Z");
const member = {
  memberId: "member",
  workspaceId: "workspace",
  userId: null,
  role: "member" as const,
};
function dependencies() {
  const repository: IdentityRepository = {
    findDemo: vi.fn(async () => ({
      ...member,
      expiresAt: new Date(now.getTime() + 1000),
    })),
    findAccount: vi.fn(async () => ({ ...member, userId: "user" })),
  };
  return { repository, getUserId: vi.fn(async () => "user"), secret, now };
}

describe("server identity resolution", () => {
  it("prefers a valid demo and never consults the account session", async () => {
    const deps = dependencies();
    const result = await resolveActor(
      {
        workspaceId: "workspace",
        demoCookie: signDemoToken(token, "member", secret),
      },
      deps,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { kind: "demo", ...member },
    });
    expect(deps.getUserId).not.toHaveBeenCalled();
    expect(deps.repository.findDemo).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "member",
    );
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
  });
  it("resolves accounts through exact workspace membership", async () => {
    const deps = dependencies();
    const result = await resolveActor({ workspaceId: "workspace" }, deps);
    expect(result).toMatchObject({
      ok: true,
      value: { kind: "account", userId: "user" },
    });
    expect(deps.repository.findAccount).toHaveBeenCalledWith(
      "user",
      "workspace",
    );
  });
  it("denies absent authentication and missing membership", async () => {
    const deps = dependencies();
    deps.getUserId.mockResolvedValueOnce(null as unknown as string);
    expect(
      await resolveActor({ workspaceId: "workspace" }, deps),
    ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    vi.mocked(deps.repository.findAccount).mockResolvedValueOnce(null);
    expect(
      await resolveActor({ workspaceId: "workspace" }, deps),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
  });
  it("fails closed on a malformed cookie instead of inheriting an account owner", async () => {
    const deps = dependencies();
    expect(
      await resolveActor(
        { workspaceId: "workspace", demoCookie: "tampered" },
        deps,
      ),
    ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(deps.getUserId).not.toHaveBeenCalled();
    expect(deps.repository.findDemo).not.toHaveBeenCalled();
  });
  it.each([null, { ...member, expiresAt: now }])(
    "rejects missing or expired demo records",
    async (record) => {
      const deps = dependencies();
      vi.mocked(deps.repository.findDemo).mockResolvedValueOnce(record);
      expect(
        await resolveActor(
          {
            workspaceId: "workspace",
            demoCookie: signDemoToken(token, "member", secret),
          },
          deps,
        ),
      ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
      expect(deps.getUserId).not.toHaveBeenCalled();
    },
  );
  it("denies cross-workspace and mismatched persona results", async () => {
    const deps = dependencies();
    const input = {
      workspaceId: "another",
      demoCookie: signDemoToken(token, "member", secret),
    };
    expect(await resolveActor(input, deps)).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    vi.mocked(deps.repository.findDemo).mockResolvedValueOnce({
      ...member,
      role: "owner",
      expiresAt: new Date(now.getTime() + 1000),
    });
    expect(
      await resolveActor({ ...input, workspaceId: "workspace" }, deps),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    vi.mocked(deps.repository.findAccount).mockResolvedValueOnce({
      ...member,
      userId: "someone-else",
    });
    expect(
      await resolveActor({ workspaceId: "workspace" }, deps),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
  });
});
