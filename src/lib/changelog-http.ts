import type { createChangelogService } from "@/features/roadmap/changelog-service";
import type { FeedbackActor } from "@/features/feedback/types";
import { domainError } from "./http/errors";
import { err, type Result } from "./http/result";
import { feedbackUnavailable, readBody, respond } from "./feedback-http";
export type ChangelogAction = "create" | "update" | "publish" | "completed";
export function createChangelogHandler(options: {
  appUrl: string;
  loadContext: (slug: string) => Promise<
    Result<{
      actor: FeedbackActor;
      workspace: { id: string };
      changelog: ReturnType<typeof createChangelogService>;
    }>
  >;
}) {
  return async (
    action: ChangelogAction,
    request: Request,
    slug: string,
    id = "",
  ) => {
    if (
      action !== "completed" &&
      request.headers.get("origin") !== new URL(options.appUrl).origin
    )
      return respond(err(domainError("FORBIDDEN")));
    let body;
    if (action === "create" || action === "update") {
      try {
        body = await readBody(request);
      } catch {
        return respond(err(domainError("VALIDATION_FAILED")));
      }
    }
    try {
      const context = await options.loadContext(slug);
      if (!context.ok) return respond(context);
      const { actor, workspace, changelog } = context.value;
      switch (action) {
        case "create":
          return respond(
            await changelog.create(actor, workspace.id, body),
            201,
          );
        case "update":
          return respond(await changelog.update(actor, workspace.id, id, body));
        case "publish":
          return respond(await changelog.publish(actor, workspace.id, id));
        case "completed":
          return respond(
            await changelog.completed(
              actor,
              workspace.id,
              new URL(request.url).searchParams.get("q") ?? "",
            ),
          );
      }
    } catch {
      return feedbackUnavailable();
    }
  };
}
