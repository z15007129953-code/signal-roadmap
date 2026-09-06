import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { roadmapServices } from "@/lib/roadmap-runtime";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { ChangelogDetail } from "@/components/roadmap/changelog-views";
export const dynamic = "force-dynamic";
export default async function ReleasePage({
  params,
}: PageProps<"/[workspace]/changelog/[slug]">) {
  const path = await params;
  const context = await loadFeedbackContext(path.workspace);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor } = context.value;
  const result = await roadmapServices().changelog.detail(
    actor,
    workspace.id,
    path.slug,
  );
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={result.error.code} />;
  }
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
    >
      <a
        href={`/${encodeURIComponent(workspace.slug)}/changelog`}
        className="mb-6 inline-block py-2 text-sm underline"
      >
        All releases
      </a>
      <ChangelogDetail workspace={workspace.slug} item={result.value} />
    </WorkspaceShell>
  );
}
