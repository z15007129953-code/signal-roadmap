// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createWorkspaceActor,
  type WorkspaceActor,
  type WorkspaceRole,
} from "./actor";
import {
  canManageWorkspace,
  canModerate,
  requireRole,
  requireWorkspace,
  requireWorkspaceActor,
} from "./authorization";

const roles: WorkspaceRole[] = ["member", "moderator", "owner"];

function actor(
  role: WorkspaceRole = "member",
  kind: "account" | "demo" = "account",
): WorkspaceActor {
  return createWorkspaceActor({
    kind,
    userId: kind === "account" ? "user-1" : null,
    memberId: "member-1",
    workspaceId: "workspace-1",
    role,
  } as WorkspaceActor);
}

describe("immutable workspace actor", () => {
  it("copies and freezes identity and permissions", () => {
    const input = {
      kind: "account" as const,
      userId: "user-1",
      memberId: "member-1",
      workspaceId: "workspace-1",
      role: "member" as const,
    };
    const identity = createWorkspaceActor(input);
    input.workspaceId = "workspace-2";
    expect(identity.workspaceId).toBe("workspace-1");
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Reflect.set(identity, "role", "owner")).toBe(false);
  });

  it("supports a demo actor without an account", () => {
    expect(actor("member", "demo")).toMatchObject({
      kind: "demo",
      userId: null,
    });
  });
});

describe("workspace authentication", () => {
  it("rejects absent actors", () => {
    expect(requireWorkspaceActor(null)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(requireWorkspaceActor(undefined)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it.each(["account", "demo"] as const)("accepts a valid %s actor", (kind) => {
    const identity = actor("member", kind);
    expect(requireWorkspaceActor(identity)).toEqual({
      ok: true,
      value: identity,
    });
  });
});

describe("role hierarchy", () => {
  for (const kind of ["account", "demo"] as const) {
    for (const [roleIndex, role] of roles.entries()) {
      it.each(roles)(
        `checks ${kind} ${role} against required %s`,
        (required) => {
          const identity = actor(role, kind);
          const result = requireRole(identity, required);
          expect(result.ok).toBe(roleIndex >= roles.indexOf(required));
          if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
        },
      );
    }
  }

  it.each(roles)("requires authentication before checking %s", (role) => {
    expect(requireRole(null, role)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it.each([
    "admin",
    "OWNER",
    "",
    "toString",
    "__proto__",
    null,
    undefined,
    100,
  ])("denies invalid runtime role %s", (role) => {
    const identity = { ...actor(), role } as WorkspaceActor;
    expect(requireWorkspaceActor(identity)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(requireRole(identity, "member").ok).toBe(false);
    expect(canModerate(identity)).toBe(false);
    expect(canManageWorkspace(identity)).toBe(false);
    expect(requireRole(actor("owner"), role as WorkspaceRole).ok).toBe(false);
  });
});

describe("permission predicates", () => {
  it.each<[WorkspaceRole, boolean, boolean]>([
    ["member", false, false],
    ["moderator", true, false],
    ["owner", true, true],
  ])("checks %s permissions", (role, moderate, manage) => {
    for (const kind of ["account", "demo"] as const) {
      expect(canModerate(actor(role, kind))).toBe(moderate);
      expect(canManageWorkspace(actor(role, kind))).toBe(manage);
    }
  });

  it("denies absent actors", () => {
    expect(canModerate(null)).toBe(false);
    expect(canManageWorkspace(null)).toBe(false);
  });
});

describe("workspace boundary", () => {
  it.each(roles)("allows %s only in its own workspace", (role) => {
    const identity = actor(role);
    expect(requireWorkspace(identity, "workspace-1")).toEqual({
      ok: true,
      value: identity,
    });
    for (const workspaceId of [
      "workspace-2",
      "",
      "WORKSPACE-1",
      "workspace-1 ",
    ]) {
      expect(requireWorkspace(identity, workspaceId)).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    }
  });

  it("applies the same boundary to demo owners", () => {
    expect(requireWorkspace(actor("owner", "demo"), "workspace-2").ok).toBe(
      false,
    );
  });

  it("requires authentication before checking the workspace", () => {
    expect(requireWorkspace(null, "workspace-1")).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });
});
