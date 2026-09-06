import type { Result } from "@/lib/http/result";
import type { FeedbackActor } from "../feedback/types";
import type { EngagementPageInput } from "../feedback/engagement-types";
export type NotificationItem = {
  id: string;
  feedbackId: string | null;
  feedbackSlug: string | null;
  changelogSlug?: string | null;
  type:
    | "comment_added"
    | "status_changed"
    | "feedback_merged"
    | "changelog_published";
  title: string;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
};
export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};
export interface NotificationRepository {
  list(
    actor: FeedbackActor,
    workspaceId: string,
    input: EngagementPageInput,
  ): Promise<Result<NotificationPage>>;
  markRead(
    actor: FeedbackActor,
    workspaceId: string,
    notificationId: string,
  ): Promise<Result<{ id: string; readAt: Date }>>;
}
