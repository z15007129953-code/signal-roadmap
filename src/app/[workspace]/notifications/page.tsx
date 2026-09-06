import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { engagementServices } from "@/lib/engagement-runtime";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
export const dynamic = "force-dynamic";
export default safePage(NotificationsPage);
async function NotificationsPage({
  params,
}: PageProps<"/[workspace]/notifications">) {
  const { workspace: slug } = await params;
  const context = await loadFeedbackContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { actor, workspace } = context.value;
  const result = await engagementServices().notifications.list(
    actor,
    workspace.id,
  );
  if (!result.ok) return <FeedbackAccessNotice code={result.error.code} />;
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
    >
      <h1 className="mb-6 font-serif text-3xl">Notifications</h1>
      <NotificationInbox
        key={actor?.memberId}
        workspace={workspace.slug}
        initial={result.value}
      />
    </WorkspaceShell>
  );
}
import { safePage } from "@/lib/security/render-boundary";
