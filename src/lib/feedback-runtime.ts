import "server-only";
import { getCurrentActor } from "@/features/auth/current-actor";
import { createFeedbackRepository } from "@/features/feedback/feedback-repository";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { resolveFeedbackContext } from "./feedback-context";
import { createFeedbackHandlers, feedbackUnavailable } from "./feedback-http";

export function loadFeedbackContext(slug: string) {
  return resolveFeedbackContext(
    slug,
    createFeedbackRepository(getDatabase()),
    getCurrentActor,
  );
}
export async function handleFeedbackRequest(
  action: "create" | "suggest",
  request: Request,
  slug: string,
) {
  try {
    return await createFeedbackHandlers({
      appUrl: getEnv().APP_URL,
      loadContext: loadFeedbackContext,
    })[action](request, slug);
  } catch {
    return feedbackUnavailable();
  }
}
