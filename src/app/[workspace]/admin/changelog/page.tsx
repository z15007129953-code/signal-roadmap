import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { roadmapServices } from "@/lib/roadmap-runtime";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { ChangelogList } from "@/components/roadmap/changelog-views";
import { ChangelogEditor } from "@/components/roadmap/changelog-editor";
export const dynamic = "force-dynamic";
export default async function ReleaseAdminPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/admin/changelog">) {
  const { workspace: slug } = await params;
  const context = await loadFeedbackContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor } = context.value;
  const search = await searchParams;
  const { changelog } = roadmapServices();
  const completed = await changelog.completed(actor, workspace.id);
  if (!completed.ok)
    return <FeedbackAccessNotice code={completed.error.code} />;
  if (search.edit && typeof search.edit !== "string")
    return <FeedbackAccessNotice code="VALIDATION_FAILED" />;
  const entry =
    typeof search.edit === "string"
      ? await changelog.detail(actor, workspace.id, search.edit)
      : undefined;
  if (entry && !entry.ok)
    return <FeedbackAccessNotice code={entry.error.code} />;
  const drafts = await changelog.list(actor, workspace.id, {
    visibility: "draft",
    limit: 20,
    ...(search.cursor ? { cursor: search.cursor } : {}),
  });
  if (!drafts.ok) return <FeedbackAccessNotice code={drafts.error.code} />;
  return (
    <WorkspaceShell workspace={workspace} moderator>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl">
          {entry ? "Edit release" : "Write a release"}
        </h1>
        <a
          href={`/${encodeURIComponent(workspace.slug)}/changelog`}
          className="py-2 underline"
        >
          Published releases
        </a>
      </div>
      <ChangelogEditor
        key={entry?.ok ? entry.value.id : "new"}
        workspace={workspace.slug}
        initial={entry?.ok ? entry.value : undefined}
        completed={completed.value}
      />
      <section className="mt-16 grid gap-5">
        <h2 className="font-serif text-2xl">Saved drafts</h2>
        <ChangelogList workspace={workspace.slug} page={drafts.value} draft />
      </section>
    </WorkspaceShell>
  );
}
