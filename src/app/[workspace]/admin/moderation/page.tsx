import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { ModerationQueue } from "@/components/moderation/moderation-queue";
export const dynamic = "force-dynamic";
export default safePage(ModerationPage);
async function ModerationPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/admin/moderation">) {
  const { workspace: slug } = await params;
  const context = await loadFeedbackContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor, service } = context.value;
  const query = await searchParams;
  const result = await service.list(actor, workspace.id, {
    visibility: "pending",
    limit: 20,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  if (!result.ok) return <FeedbackAccessNotice code={result.error.code} />;
  return (
    <WorkspaceShell workspace={workspace} moderator>
      <ModerationQueue workspace={workspace.slug} page={result.value} />
    </WorkspaceShell>
  );
}
import { safePage } from "@/lib/security/render-boundary";
