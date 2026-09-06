import { domainError } from "@/lib/http/errors";
import { err } from "@/lib/http/result";
import { engagementBoundary } from "../feedback/engagement-service";
import { engagementPageSchema } from "../feedback/engagement-schema";
import type { FeedbackActor } from "../feedback/types";
import type { NotificationRepository } from "./notification-types";
export function createNotificationService(repository: NotificationRepository) {
  return {
    async list(actor: FeedbackActor, workspaceId: string, input: unknown = {}) {
      const allowed = engagementBoundary(actor, workspaceId, [], true);
      if (!allowed.ok) return allowed;
      const parsed = engagementPageSchema.safeParse(input);
      return parsed.success
        ? repository.list(actor, workspaceId, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    async markRead(actor: FeedbackActor, workspaceId: string, id: string) {
      const allowed = engagementBoundary(actor, workspaceId, [id], true);
      return allowed.ok ? repository.markRead(actor, workspaceId, id) : allowed;
    },
  };
}
