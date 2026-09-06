import { describe, expect, it, vi } from "vitest";
import { createSettingsService } from "./settings-service";
import {
  brandingSchema,
  boardSchema,
  tagSchema,
  logoKeySchema,
  memberQuerySchema,
} from "./settings-schema";
import type { SettingsRepository } from "./settings-types";
import type { WorkspaceActor } from "../auth/actor";
const w = "10000000-0000-4000-8000-000000000001";
const actor: WorkspaceActor = {
  kind: "account",
  workspaceId: w,
  memberId: "10000000-0000-4000-8000-000000000002",
  userId: "user",
  role: "member",
};
describe("settings boundaries", () => {
  it("validates strict branding and scoped logo keys", () => {
    expect(
      brandingSchema.parse({
        name: "  Signal  ",
        description: "Board",
        accentColor: "#aAbB00",
      }),
    ).toEqual({ name: "Signal", description: "Board", accentColor: "#aAbB00" });
    for (const input of [
      { name: "", description: null, accentColor: null },
      { name: "Signal", description: null, accentColor: "red" },
      {
        name: "Signal",
        description: null,
        accentColor: null,
        logoKey: "https://external.test/a.png",
      },
    ])
      expect(brandingSchema.safeParse(input).success).toBe(false);
    expect(
      logoKeySchema(w).safeParse(
        `${w}/logos/10000000-0000-4000-8000-000000000003.webp`,
      ).success,
    ).toBe(true);
    for (const key of [
      "https://external.test/a.png",
      `other/logos/10000000-0000-4000-8000-000000000003.png`,
      `${w}/logos/../a.png`,
      `${w}/logos/10000000-0000-4000-8000-000000000003.PNG`,
    ])
      expect(logoKeySchema(w).safeParse(key).success).toBe(false);
    expect(logoKeySchema(w).safeParse(null).success).toBe(true);
  });
  it("normalizes slugs and bounds names, ordering, and member pages", () => {
    expect(
      boardSchema.parse({
        name: "Ideas",
        slug: "IDEAS",
        description: null,
        position: 0,
      }).slug,
    ).toBe("ideas");
    expect(
      tagSchema.parse({ name: "UX", slug: "UX", color: "#abcdef" }).slug,
    ).toBe("ux");
    expect(
      boardSchema.safeParse({
        name: "a".repeat(81),
        slug: "bad slug",
        position: -1,
      }).success,
    ).toBe(false);
    expect(
      tagSchema.safeParse({ name: "a".repeat(41), slug: "ux", color: "red" })
        .success,
    ).toBe(false);
    expect(memberQuerySchema.parse({})).toEqual({ limit: 20, search: "" });
    expect(memberQuerySchema.safeParse({ limit: 21 }).success).toBe(false);
    expect(memberQuerySchema.safeParse({ cursor: "broken" }).success).toBe(
      false,
    );
  });
  it("rejects malformed, anonymous, and cross-tenant requests before repository access", async () => {
    const get = vi.fn();
    const service = createSettingsService({
      get,
    } as unknown as SettingsRepository);
    expect(await service.get(null, w)).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(await service.get(actor, "bad")).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    expect(
      await service.get(actor, "10000000-0000-4000-8000-000000000009"),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(get).not.toHaveBeenCalled();
  });
  it("delegates persisted authorization and validates all mutation inputs", async () => {
    const success = { ok: true, value: null };
    const repo = Object.fromEntries(
      [
        "get",
        "branding",
        "setLogo",
        "saveBoard",
        "deleteBoard",
        "saveTag",
        "deleteTag",
        "changeRole",
      ].map((key) => [key, vi.fn().mockResolvedValue(success)]),
    ) as unknown as SettingsRepository;
    const service = createSettingsService(repo);
    expect(
      await service.branding(actor, w, {
        name: " Signal ",
        description: null,
        accentColor: null,
      }),
    ).toEqual(success);
    expect(repo.branding).toHaveBeenCalledWith(actor, w, {
      name: "Signal",
      description: null,
      accentColor: null,
    });
    for (const result of [
      await service.branding(actor, w, {}),
      await service.setLogo(actor, w, "https://x.test/a.png"),
      await service.saveBoard(actor, w, {}),
      await service.saveTag(actor, w, {}),
      await service.deleteBoard(actor, w, "bad"),
      await service.deleteTag(actor, w, "bad"),
      await service.changeRole(actor, w, {
        memberId: actor.memberId,
        role: "admin",
      }),
    ])
      expect(result).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
  });
});
