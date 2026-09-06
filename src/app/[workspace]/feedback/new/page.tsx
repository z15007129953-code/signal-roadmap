import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";

export const dynamic = "force-dynamic";
export default safePage(NewFeedbackPage);
async function NewFeedbackPage({
  params,
}: PageProps<"/[workspace]/feedback/new">) {
  const context = await loadFeedbackContext((await params).workspace);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor, service } = context.value;
  if (!actor) return <FeedbackAccessNotice code="UNAUTHENTICATED" />;
  const taxonomy = await service.taxonomy(actor, workspace.id);
  if (!taxonomy.ok) return <FeedbackAccessNotice code={taxonomy.error.code} />;
  return (
    <WorkspaceShell workspace={workspace} moderator={actor.role !== "member"}>
      <div className="mb-8 grid max-w-2xl gap-3">
        <h1 className="font-serif text-3xl">What would make this better?</h1>
        <p className="text-muted">
          Share one idea and the problem it would solve.
          {actor.role === "member"
            ? " Your feedback will be reviewed before it appears on the board."
            : " Your feedback will be published immediately."}
        </p>
      </div>
      <FeedbackForm workspace={workspace.slug} taxonomy={taxonomy.value} />
    </WorkspaceShell>
  );
}
import { safePage } from "@/lib/security/render-boundary";
