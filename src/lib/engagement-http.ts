import type { createEngagementService } from "@/features/feedback/engagement-service";
import type { createNotificationService } from "@/features/notifications/notification-service";
import type { FeedbackActor } from "@/features/feedback/types";
import { err, type Result } from "./http/result";
import { domainError } from "./http/errors";
import { feedbackUnavailable, readBody, respond } from "./feedback-http";

export type EngagementContext = {
  actor: FeedbackActor;
  workspace: { id: string };
  engagement: ReturnType<typeof createEngagementService>;
  notifications: ReturnType<typeof createNotificationService>;
};
export type EngagementAction =
  | "vote"
  | "follow"
  | "comments"
  | "comment-create"
  | "comment-edit"
  | "comment-delete"
  | "notifications"
  | "notification-read";
export function createEngagementHandlers(options: {
  appUrl: string;
  loadContext: (slug: string) => Promise<Result<EngagementContext>>;
}) {
  return async function handle(
    action: EngagementAction,
    request: Request,
    slug: string,
    feedbackId = "",
    itemId = "",
  ) {
    const write = !["comments", "notifications"].includes(action);
    if (
      write &&
      request.headers.get("origin") !== new URL(options.appUrl).origin
    )
      return respond(err(domainError("FORBIDDEN")));
    let body: unknown;
    if (
      write &&
      action !== "comment-delete" &&
      action !== "notification-read"
    ) {
      try {
        body = await readBody(request);
      } catch {
        return respond(err(domainError("VALIDATION_FAILED")));
      }
    }
    try {
      const context = await options.loadContext(slug);
      if (!context.ok) return respond(context);
      const { actor, workspace, engagement, notifications } = context.value;
      const query = new URL(request.url).searchParams;
      const page = {
        ...(query.has("cursor") ? { cursor: query.get("cursor") } : {}),
        ...(query.has("limit") ? { limit: query.get("limit") } : {}),
      };
      switch (action) {
        case "vote":
          return respond(
            await engagement.setVote(actor, workspace.id, feedbackId, body),
          );
        case "follow":
          return respond(
            await engagement.setFollow(actor, workspace.id, feedbackId, body),
          );
        case "comments":
          return respond(
            await engagement.listComments(
              actor,
              workspace.id,
              feedbackId,
              page,
            ),
          );
        case "comment-create":
          return respond(
            await engagement.createComment(
              actor,
              workspace.id,
              feedbackId,
              body,
            ),
            201,
          );
        case "comment-edit":
          return respond(
            await engagement.editComment(
              actor,
              workspace.id,
              feedbackId,
              itemId,
              body,
            ),
          );
        case "comment-delete":
          return respond(
            await engagement.deleteComment(
              actor,
              workspace.id,
              feedbackId,
              itemId,
            ),
          );
        case "notifications":
          return respond(await notifications.list(actor, workspace.id, page));
        case "notification-read":
          return respond(
            await notifications.markRead(actor, workspace.id, itemId),
          );
      }
    } catch {
      return feedbackUnavailable();
    }
  };
}
