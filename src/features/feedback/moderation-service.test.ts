import { describe, expect, it, vi } from "vitest";
import { createModerationService } from "./moderation-service";
import type { ModerationRepository } from "./moderation-types";
const w = "10000000-0000-4000-8000-000000000001";
const id = "10000000-0000-4000-8000-000000000002";
const actor = {
  kind: "account" as const,
  workspaceId: w,
  memberId: id,
  userId: "user",
  role: "owner" as const,
};
function setup() {
  const repository = Object.fromEntries(
    [
      "approve",
      "reject",
      "setStatus",
      "setTaxonomy",
      "merge",
      "redirect",
      "history",
    ].map((k) => [k, vi.fn()]),
  ) as unknown as ModerationRepository;
  return { repository, service: createModerationService(repository) };
}
describe("moderation service", () => {
  it("rejects invalid, anonymous, and cross workspace writes", async () => {
    const { service, repository } = setup();
    expect(await service.approve(null, w, id)).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(await service.reject(actor, w, "bad")).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    expect(
      await service.approve({ ...actor, workspaceId: id }, w, id),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(repository.approve).not.toHaveBeenCalled();
  });
  it("strictly validates taxonomy, states, and merge targets", async () => {
    const { service, repository } = setup();
    for (const input of [
      { status: "rejected" },
      { status: "closed", extra: true },
    ])
      expect(await service.setStatus(actor, w, id, input)).toMatchObject({
        error: { code: "VALIDATION_FAILED" },
      });
    for (const input of [
      { boardId: w, tagIds: Array(6).fill(id) },
      { boardId: w, tagIds: [id, id] },
      { boardId: "bad", tagIds: [] },
    ])
      expect(await service.setTaxonomy(actor, w, id, input)).toMatchObject({
        error: { code: "VALIDATION_FAILED" },
      });
    expect(await service.merge(actor, w, id, { targetId: id })).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    await service.setStatus(actor, w, id, { status: "planned" });
    expect(repository.setStatus).toHaveBeenCalledWith(actor, w, id, {
      status: "planned",
    });
  });
  it("bounds history and validates redirects", async () => {
    const { service, repository } = setup();
    expect(await service.history(null, w, id, { limit: 101 })).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    expect(await service.redirect(null, w, "")).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    await service.history(null, w, id);
    expect(repository.history).toHaveBeenCalledWith(null, w, id, { limit: 20 });
  });
});
