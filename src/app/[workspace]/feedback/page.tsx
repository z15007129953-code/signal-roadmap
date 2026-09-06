import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { feedbackFiltersSchema } from "@/features/feedback/feedback-schema";
import { FeedbackList } from "@/components/feedback/feedback-views";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";

export const dynamic = "force-dynamic";
export default async function FeedbackPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/feedback">) {
  const { workspace: slug } = await params;
  const context = await loadFeedbackContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor, service } = context.value;
  const search = await searchParams;
  const raw: Record<string, unknown> = {};
  for (const key of ["boardId", "tagId", "status", "cursor", "visibility"])
    if (search[key]) raw[key] = search[key];
  if (search.q) raw.query = search.q;
  const parsed = feedbackFiltersSchema.safeParse(raw);
  if (!parsed.success) return <FeedbackAccessNotice code="VALIDATION_FAILED" />;
  const [list, taxonomy] = await Promise.all([
    service.list(actor, workspace.id, parsed.data),
    service.taxonomy(actor, workspace.id),
  ]);
  if (!list.ok) return <FeedbackAccessNotice code={list.error.code} />;
  if (!taxonomy.ok) return <FeedbackAccessNotice code={taxonomy.error.code} />;
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
    >
      <FeedbackList
        workspace={workspace.slug}
        taxonomy={taxonomy.value}
        filters={parsed.data}
        page={list.value}
      />
    </WorkspaceShell>
  );
}
