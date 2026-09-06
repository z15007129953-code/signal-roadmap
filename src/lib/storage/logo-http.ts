import { z } from "zod";
import type { loadSettingsContext } from "../settings-runtime";
import type { createLogoStorage } from "./r2";
import { feedbackUnavailable, readBody, respond } from "../feedback-http";
import { domainError } from "../http/errors";
import { err, ok } from "../http/result";
import { logoUploadSchema } from "./logo-policy";
const workspaceSchema = z.string().regex(/^[a-z0-9-]{1,120}$/);
const prepareSchema = logoUploadSchema.extend({ workspace: workspaceSchema });
const attachSchema = z.strictObject({
  workspace: workspaceSchema,
  key: z.string().max(200).nullable(),
});
export function createLogoHandler(options: {
  appUrl: string;
  loadContext: typeof loadSettingsContext;
  storage: () => ReturnType<typeof createLogoStorage> | null;
}) {
  return async (request: Request) => {
    if (request.headers.get("origin") !== new URL(options.appUrl).origin)
      return respond(err(domainError("FORBIDDEN")));
    let body;
    try {
      body = await readBody(request);
    } catch {
      return respond(err(domainError("VALIDATION_FAILED")));
    }
    const parsed = (
      request.method === "POST" ? prepareSchema : attachSchema
    ).safeParse(body);
    if (!parsed.success) return respond(err(domainError("VALIDATION_FAILED")));
    try {
      const context = await options.loadContext(parsed.data.workspace);
      if (!context.ok) return respond(context);
      const { actor, workspace, settings } = context.value;
      const access = await settings.get(actor, workspace.id);
      if (!access.ok) return respond(access);
      if (access.value.role !== "owner" || access.value.isDemo)
        return respond(err(domainError("FORBIDDEN")));
      const storage = options.storage();
      if (!storage) return feedbackUnavailable();
      if ("type" in parsed.data) {
        return respond(
          ok(
            await storage.prepare(workspace.id, {
              type: parsed.data.type,
              size: parsed.data.size,
            }),
          ),
        );
      }
      if (parsed.data.key !== null) {
        try {
          await storage.verify(workspace.id, parsed.data.key);
        } catch {
          return respond(err(domainError("VALIDATION_FAILED")));
        }
      }
      return respond(
        await settings.setLogo(actor, workspace.id, parsed.data.key),
      );
    } catch {
      return feedbackUnavailable();
    }
  };
}
