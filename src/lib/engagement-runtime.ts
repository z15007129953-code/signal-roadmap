import "server-only";
import { createEngagementService } from "@/features/feedback/engagement-service";
import { createEngagementRepository } from "@/features/feedback/engagement-repository";
import { createNotificationService } from "@/features/notifications/notification-service";
import { createNotificationRepository } from "@/features/notifications/notification-repository";
import { loadFeedbackContext } from "./feedback-runtime";
import { getDatabase } from "./db";
import { getEnv } from "./env";
import { ok } from "./http/result";
import {
  createEngagementHandlers,
  type EngagementAction,
} from "./engagement-http";
import { feedbackUnavailable } from "./feedback-http";

export function engagementServices() {
  const db = getDatabase();
  return {
    engagement: createEngagementService(createEngagementRepository(db)),
    notifications: createNotificationService(createNotificationRepository(db)),
  };
}
export async function handleEngagementRequest(
  action: EngagementAction,
  request: Request,
  slug: string,
  feedbackId?: string,
  itemId?: string,
) {
  try {
    return await createEngagementHandlers({
      appUrl: getEnv().APP_URL,
      loadContext: async (slug) => {
        const context = await loadFeedbackContext(slug);
        return context.ok
          ? ok({ ...context.value, ...engagementServices() })
          : context;
      },
    })(action, request, slug, feedbackId, itemId);
  } catch {
    return feedbackUnavailable();
  }
}
