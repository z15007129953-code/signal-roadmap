import type { createSettingsService } from "@/features/settings/settings-service";
import type { FeedbackActor } from "@/features/feedback/types";
import { domainError } from "./http/errors";
import { err, type Result } from "./http/result";
import { feedbackUnavailable, readBody, respond } from "./feedback-http";
export type SettingsAction =
  "get" | "branding" | "board" | "deleteBoard" | "tag" | "deleteTag" | "role";
export function createSettingsHandler(options: {
  appUrl: string;
  loadContext: (slug: string) => Promise<
    Result<{
      actor: FeedbackActor;
      workspace: { id: string };
      settings: ReturnType<typeof createSettingsService>;
    }>
  >;
}) {
  return async (
    action: SettingsAction,
    request: Request,
    slug: string,
    id = "",
  ) => {
    if (
      action !== "get" &&
      request.headers.get("origin") !== new URL(options.appUrl).origin
    )
      return respond(err(domainError("FORBIDDEN")));
    let body: unknown;
    if (["branding", "board", "tag", "role"].includes(action)) {
      try {
        body = await readBody(request);
      } catch {
        return respond(err(domainError("VALIDATION_FAILED")));
      }
    }
    try {
      const context = await options.loadContext(slug);
      if (!context.ok) return respond(context);
      const { actor, workspace, settings } = context.value;
      const w = workspace.id;
      switch (action) {
        case "get": {
          const params = new URL(request.url).searchParams;
          return respond(
            await settings.get(actor, w, {
              search: params.get("search") ?? "",
              ...(params.has("cursor") ? { cursor: params.get("cursor") } : {}),
            }),
          );
        }
        case "branding":
          return respond(await settings.branding(actor, w, body));
        case "board":
          return respond(await settings.saveBoard(actor, w, body));
        case "tag":
          return respond(await settings.saveTag(actor, w, body));
        case "deleteBoard":
          return respond(await settings.deleteBoard(actor, w, id));
        case "deleteTag":
          return respond(await settings.deleteTag(actor, w, id));
        case "role":
          return respond(await settings.changeRole(actor, w, body));
      }
    } catch {
      return feedbackUnavailable();
    }
  };
}
