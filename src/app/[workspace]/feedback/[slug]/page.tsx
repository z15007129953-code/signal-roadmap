import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { FeedbackDetail } from "@/components/feedback/feedback-views";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { feedbackPath } from "@/components/feedback/paths";

export const dynamic = "force-dynamic";
export default async function FeedbackDetailPage({
  params,
}: PageProps<"/[workspace]/feedback/[slug]">) {
  const path = await params;
  const context = await loadFeedbackContext(path.workspace);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor, service } = context.value;
  const detail = await service.detail(actor, workspace.id, path.slug);
  if (!detail.ok) {
    if (detail.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={detail.error.code} />;
  }
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
    >
      <a
        href={feedbackPath(workspace.slug)}
        className="mb-6 inline-block py-2 text-sm underline"
      >
        Back to feedback
      </a>
      <FeedbackDetail item={detail.value} />
    </WorkspaceShell>
  );
}
