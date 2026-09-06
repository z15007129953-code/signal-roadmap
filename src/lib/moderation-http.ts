import { z } from "zod";
import type { createModerationService } from "@/features/feedback/moderation-service";
import type { FeedbackActor } from "@/features/feedback/types";
import { err, type Result } from "./http/result";
import { domainError } from "./http/errors";
import { feedbackUnavailable, readBody, respond } from "./feedback-http";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }).strict(),
  z.object({ action: z.literal("reject") }).strict(),
  z.object({ action: z.literal("status"), status: z.string() }).strict(),
  z
    .object({
      action: z.literal("taxonomy"),
      boardId: z.string(),
      tagIds: z.array(z.string()),
    })
    .strict(),
  z.object({ action: z.literal("merge"), targetId: z.string() }).strict(),
]);
type ModerationContext = {
  workspace: { id: string };
  actor: FeedbackActor;
  moderation: ReturnType<typeof createModerationService>;
};
export function createModerationHandler(options: {
  appUrl: string;
  loadContext: (slug: string) => Promise<Result<ModerationContext>>;
}) {
  return async (request: Request, slug: string, feedbackId: string) => {
    if (request.headers.get("origin") !== new URL(options.appUrl).origin)
      return respond(err(domainError("FORBIDDEN")));
    let parsed;
    try {
      parsed = actionSchema.safeParse(await readBody(request));
    } catch {
      return respond(err(domainError("VALIDATION_FAILED")));
    }
    if (!parsed.success) return respond(err(domainError("VALIDATION_FAILED")));
    try {
      const context = await options.loadContext(slug);
      if (!context.ok) return respond(context);
      const { workspace, actor, moderation } = context.value;
      const input = parsed.data;
      switch (input.action) {
        case "approve":
          return respond(
            await moderation.approve(actor, workspace.id, feedbackId),
          );
        case "reject":
          return respond(
            await moderation.reject(actor, workspace.id, feedbackId),
          );
        case "status":
          return respond(
            await moderation.setStatus(actor, workspace.id, feedbackId, {
              status: input.status,
            }),
          );
        case "taxonomy":
          return respond(
            await moderation.setTaxonomy(actor, workspace.id, feedbackId, {
              boardId: input.boardId,
              tagIds: input.tagIds,
            }),
          );
        case "merge":
          return respond(
            await moderation.merge(actor, workspace.id, feedbackId, {
              targetId: input.targetId,
            }),
          );
      }
    } catch {
      return feedbackUnavailable();
    }
  };
}
