import { describe, expect, it, vi } from "vitest";
import { createFeedbackService } from "./feedback-service";
import type { FeedbackRepository, FeedbackItem } from "./types";
import type { WorkspaceActor } from "../auth/actor";
import { ok, err } from "@/lib/http/result";
import { domainError } from "@/lib/http/errors";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actor: WorkspaceActor = {
  kind: "account",
  workspaceId,
  memberId: workspaceId,
  role: "member",
  userId: "user",
};
const input = {
  title: "Dark mode",
  description: "Please support dark mode",
  boardId: workspaceId,
};
const item: FeedbackItem = {
  id: workspaceId,
  slug: "dark-mode",
  title: input.title,
  body: input.description,
  authorId: actor.memberId,
  boardId: workspaceId,
  status: "under_review",
  visibility: "pending",
  createdAt: new Date(),
};
function repository(): FeedbackRepository {
  return {
    workspaceBySlug: vi.fn(async () => null),
    create: vi.fn(async () => ok(item)),
    findBySlug: vi.fn(async () => ok(item)),
    listPublished: vi.fn(async () => ok({ items: [], nextCursor: null })),
    listPending: vi.fn(async () => ok({ items: [], nextCursor: null })),
    searchSimilarTitles: vi.fn(async () => ok([])),
    taxonomy: vi.fn(async () => ok({ boards: [], tags: [] })),
  };
}
describe("feedback service", () => {
  it("creates validated content without trusting client privilege", async () => {
    const repo = repository();
    const service = createFeedbackService(repo);
    expect(
      (
        await service.create(actor, workspaceId, {
          ...input,
          title: " Dark mode ",
        })
      ).ok,
    ).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(actor, workspaceId, {
      ...input,
      tagIds: [],
    });
    expect(
      await service.create(actor, workspaceId, {
        ...input,
        visibility: "published",
      }),
    ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
  });
  it("rejects anonymous and cross-workspace writes before persistence", async () => {
    const repo = repository();
    const service = createFeedbackService(repo);
    expect(await service.create(null, workspaceId, input)).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(
      await service.create(
        { ...actor, workspaceId: "22222222-2222-4222-8222-222222222222" },
        workspaceId,
        input,
      ),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("keeps ordinary published reads anonymous but rejects foreign actors", async () => {
    const repo = repository();
    const service = createFeedbackService(repo);
    expect((await service.list(null, workspaceId, {})).ok).toBe(true);
    expect(repo.listPublished).toHaveBeenCalledWith(null, workspaceId, {
      limit: 20,
      visibility: "published",
    });
    expect(
      await service.detail(
        { ...actor, workspaceId: "other" },
        workspaceId,
        "dark-mode",
      ),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(repo.findBySlug).not.toHaveBeenCalled();
  });
  it("restricts moderation queue and preserves persistence authorization errors", async () => {
    const repo = repository();
    const service = createFeedbackService(repo);
    expect(
      await service.list(actor, workspaceId, { visibility: "pending" }),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(repo.listPending).not.toHaveBeenCalled();
    const moderator = { ...actor, role: "moderator" as const };
    vi.mocked(repo.listPending).mockResolvedValue(
      err(domainError("DEMO_EXPIRED")),
    );
    expect(
      await service.list(moderator, workspaceId, { visibility: "pending" }),
    ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
  });
  it("bounds suggestions and never makes suggestions a prerequisite to create", async () => {
    const repo = repository();
    const service = createFeedbackService(repo);
    await service.suggest(actor, workspaceId, "  Dark mode  ");
    expect(repo.searchSimilarTitles).toHaveBeenCalledWith(
      actor,
      workspaceId,
      "Dark mode",
    );
    await service.create(actor, workspaceId, input);
    expect(repo.searchSimilarTitles).toHaveBeenCalledTimes(1);
    expect(await service.suggest(null, workspaceId, " ")).toEqual(ok([]));
  });
});
