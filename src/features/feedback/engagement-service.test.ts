import { describe, expect, it, vi } from "vitest";
import { createEngagementService } from "./engagement-service";
import type { EngagementRepository } from "./engagement-types";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const feedbackId = "10000000-0000-4000-8000-000000000002";
const actor = {
  kind: "account" as const,
  workspaceId,
  memberId: "10000000-0000-4000-8000-000000000003",
  userId: "user",
  role: "member" as const,
};
function setup() {
  const repository = {
    state: vi.fn(),
    setVote: vi.fn(),
    setFollow: vi.fn(),
    listComments: vi.fn(),
    createComment: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(),
  } as unknown as EngagementRepository;
  return { repository, service: createEngagementService(repository) };
}
describe("engagement service validation", () => {
  it("normalizes edit bodies and validates delete identifiers", async () => {
    const { service, repository } = setup();
    const commentId = "10000000-0000-4000-8000-000000000004";
    await service.editComment(actor, workspaceId, feedbackId, commentId, {
      body: " Revised ",
    });
    expect(repository.editComment).toHaveBeenCalledWith(
      actor,
      workspaceId,
      feedbackId,
      commentId,
      { body: "Revised" },
    );
    expect(
      await service.deleteComment(actor, workspaceId, feedbackId, "invalid"),
    ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    expect(repository.deleteComment).not.toHaveBeenCalled();
    await service.deleteComment(actor, workspaceId, feedbackId, commentId);
    expect(repository.deleteComment).toHaveBeenCalledWith(
      actor,
      workspaceId,
      feedbackId,
      commentId,
    );
  });
  it("rejects unauthenticated mutations before persistence", async () => {
    const { service, repository } = setup();
    expect(
      await service.setVote(null, workspaceId, feedbackId, { active: true }),
    ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(repository.setVote).not.toHaveBeenCalled();
  });
  it("validates desired state and UUID boundaries", async () => {
    const { service, repository } = setup();
    expect(
      await service.setVote(actor, workspaceId, feedbackId, { active: "true" }),
    ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    expect(await service.state(actor, workspaceId, "bad")).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
    expect(repository.setVote).not.toHaveBeenCalled();
  });
  it("trims comments and rejects empty, long or invalid parent content", async () => {
    const { service, repository } = setup();
    for (const input of [
      { body: "  " },
      { body: "a".repeat(10001) },
      { body: "Good", parentId: "bad" },
    ])
      expect(
        await service.createComment(actor, workspaceId, feedbackId, input),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    await service.createComment(actor, workspaceId, feedbackId, {
      body: "  Hello  ",
    });
    expect(repository.createComment).toHaveBeenCalledWith(
      actor,
      workspaceId,
      feedbackId,
      { body: "Hello", parentId: null },
    );
  });
  it("rejects cross workspace and unbounded lists", async () => {
    const { service, repository } = setup();
    expect(
      await service.state(
        { ...actor, workspaceId: feedbackId },
        workspaceId,
        feedbackId,
      ),
    ).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(
      await service.listComments(actor, workspaceId, feedbackId, {
        limit: 101,
      }),
    ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    expect(repository.listComments).not.toHaveBeenCalled();
  });
});
