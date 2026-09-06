import { z } from "zod";
import { domainError } from "@/lib/http/errors";
import { err, ok } from "@/lib/http/result";
import type { FeedbackActor } from "./types";
import type { EngagementRepository } from "./engagement-types";
import {
  commentInputSchema,
  commentEditSchema,
  desiredStateSchema,
  engagementPageSchema,
} from "./engagement-schema";

export function engagementBoundary(
  actor: FeedbackActor,
  workspaceId: string,
  ids: string[] = [],
  write = false,
) {
  if (![workspaceId, ...ids].every((id) => z.uuid().safeParse(id).success))
    return err(domainError("VALIDATION_FAILED"));
  if (actor && actor.workspaceId !== workspaceId)
    return err(domainError("FORBIDDEN"));
  if (write && !actor) return err(domainError("UNAUTHENTICATED"));
  return ok(null);
}
export function createEngagementService(repository: EngagementRepository) {
  async function set(
    kind: "setVote" | "setFollow",
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    input: unknown,
  ) {
    const allowed = engagementBoundary(actor, workspaceId, [feedbackId], true);
    if (!allowed.ok) return allowed;
    const parsed = desiredStateSchema.safeParse(input);
    if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
    return repository[kind](actor, workspaceId, feedbackId, parsed.data.active);
  }
  return {
    async state(actor: FeedbackActor, workspaceId: string, feedbackId: string) {
      const allowed = engagementBoundary(actor, workspaceId, [feedbackId]);
      return allowed.ok
        ? repository.state(actor, workspaceId, feedbackId)
        : allowed;
    },
    setVote: (
      actor: FeedbackActor,
      workspaceId: string,
      feedbackId: string,
      input: unknown,
    ) => set("setVote", actor, workspaceId, feedbackId, input),
    setFollow: (
      actor: FeedbackActor,
      workspaceId: string,
      feedbackId: string,
      input: unknown,
    ) => set("setFollow", actor, workspaceId, feedbackId, input),
    async listComments(
      actor: FeedbackActor,
      workspaceId: string,
      feedbackId: string,
      input: unknown = {},
    ) {
      const allowed = engagementBoundary(actor, workspaceId, [feedbackId]);
      if (!allowed.ok) return allowed;
      const parsed = engagementPageSchema.safeParse(input);
      return parsed.success
        ? repository.listComments(actor, workspaceId, feedbackId, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    async createComment(
      actor: FeedbackActor,
      workspaceId: string,
      feedbackId: string,
      input: unknown,
    ) {
      const allowed = engagementBoundary(
        actor,
        workspaceId,
        [feedbackId],
        true,
      );
      if (!allowed.ok) return allowed;
      const parsed = commentInputSchema.safeParse(input);
      return parsed.success
        ? repository.createComment(actor, workspaceId, feedbackId, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    async editComment(
      actor: FeedbackActor,
      workspaceId: string,
      feedbackId: string,
      commentId: string,
      input: unknown,
    ) {
      const allowed = engagementBoundary(
        actor,
        workspaceId,
        [feedbackId, commentId],
        true,
      );
      if (!allowed.ok) return allowed;
      const parsed = commentEditSchema.safeParse(input);
      return parsed.success
        ? repository.editComment(
            actor,
            workspaceId,
            feedbackId,
            commentId,
            parsed.data,
          )
        : err(domainError("VALIDATION_FAILED"));
    },
    async deleteComment(
      actor: FeedbackActor,
      workspaceId: string,
      feedbackId: string,
      commentId: string,
    ) {
      const allowed = engagementBoundary(
        actor,
        workspaceId,
        [feedbackId, commentId],
        true,
      );
      return allowed.ok
        ? repository.deleteComment(actor, workspaceId, feedbackId, commentId)
        : allowed;
    },
  };
}
