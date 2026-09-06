import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import {
  demoSessions,
  feedback,
  follows,
  members,
  notifications,
} from "@/lib/db/schema";
import type { EngagementTransaction } from "../feedback/engagement-access";

/** Internal transactional helper. Caller must authorize and lock workspace then feedback.
 * A stable event key makes retries safe. Only published feedback can disclose content.
 * For a future merge event, pass the published target ID and transferred followers.
 */
export async function fanoutFeedbackNotification(
  tx: EngagementTransaction,
  input: {
    workspaceId: string;
    feedbackId: string;
    actorId: string;
    eventKey: string;
    type: "comment_added" | "status_changed" | "feedback_merged";
    title: string;
    body?: string;
  },
) {
  const [item] = await tx
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        eq(feedback.workspaceId, input.workspaceId),
        eq(feedback.id, input.feedbackId),
        eq(feedback.visibility, "published"),
      ),
    );
  if (!item) return;
  const recipients = await tx
    .select({ id: members.id })
    .from(follows)
    .innerJoin(
      members,
      and(
        eq(members.id, follows.memberId),
        eq(members.workspaceId, follows.workspaceId),
      ),
    )
    .leftJoin(
      demoSessions,
      and(
        eq(demoSessions.id, members.demoSessionId),
        eq(demoSessions.workspaceId, members.workspaceId),
      ),
    )
    .where(
      and(
        eq(follows.workspaceId, input.workspaceId),
        eq(follows.feedbackId, input.feedbackId),
        ne(follows.memberId, input.actorId),
        or(
          and(
            isNull(members.demoSessionId),
            sql`${members.userId} IS NOT NULL`,
          ),
          sql`${demoSessions.expiresAt} > clock_timestamp()`,
        ),
      ),
    );
  if (recipients.length)
    await tx
      .insert(notifications)
      .values(
        recipients.map((recipient) => ({
          workspaceId: input.workspaceId,
          recipientId: recipient.id,
          actorId: input.actorId,
          feedbackId: input.feedbackId,
          eventKey: input.eventKey,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [notifications.recipientId, notifications.eventKey],
      });
}
