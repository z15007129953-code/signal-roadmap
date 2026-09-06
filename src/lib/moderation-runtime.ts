import "server-only";
import { createModerationRepository } from "@/features/feedback/moderation-repository";
import { createModerationService } from "@/features/feedback/moderation-service";
import { loadFeedbackContext } from "./feedback-runtime";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { ok } from "./http/result";
import { createModerationHandler } from "./moderation-http";
import { feedbackUnavailable } from "./feedback-http";
export function moderationService() {
  return createModerationService(createModerationRepository(getDatabase()));
}
export async function handleModerationRequest(
  request: Request,
  slug: string,
  feedbackId: string,
) {
  try {
    return await createModerationHandler({
      appUrl: getEnv().APP_URL,
      loadContext: async (slug) => {
        const context = await loadFeedbackContext(slug);
        return context.ok
          ? ok({ ...context.value, moderation: moderationService() })
          : context;
      },
    })(request, slug, feedbackId);
  } catch {
    return feedbackUnavailable();
  }
}
