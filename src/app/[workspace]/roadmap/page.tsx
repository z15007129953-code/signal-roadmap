import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { roadmapServices } from "@/lib/roadmap-runtime";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import {
  RoadmapBoard,
  roadmapLabels,
} from "@/components/roadmap/roadmap-board";
import type { FeedbackStatus, FeedbackPage } from "@/features/feedback/types";
export const dynamic = "force-dynamic";
export default async function RoadmapPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/roadmap">) {
  const { workspace: slug } = await params;
  const context = await loadFeedbackContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor } = context.value;
  const query = await searchParams;
  const statuses = Object.keys(roadmapLabels) as FeedbackStatus[];
  if (
    (query.status &&
      (typeof query.status !== "string" ||
        !statuses.includes(query.status as FeedbackStatus))) ||
    (query.cursor && !query.status)
  )
    return <FeedbackAccessNotice code="VALIDATION_FAILED" />;
  const { roadmap } = roadmapServices();
  const results = await Promise.all(
    statuses.map((status) =>
      roadmap.list(actor, workspace.id, {
        status,
        limit: 20,
        ...(query.status === status && query.cursor
          ? { cursor: query.cursor }
          : {}),
      }),
    ),
  );
  const failure = results.find((result) => !result.ok);
  if (failure && !failure.ok)
    return <FeedbackAccessNotice code={failure.error.code} />;
  const empty = () => ({ items: [], nextCursor: null });
  const columns: Record<FeedbackStatus, FeedbackPage> = {
    under_review: empty(),
    planned: empty(),
    in_progress: empty(),
    completed: empty(),
    closed: empty(),
  };
  statuses.forEach((status, index) => {
    const result = results[index];
    if (result.ok) columns[status] = result.value;
  });
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
    >
      <div className="mb-10 grid gap-3">
        <p className="text-sm text-muted">Ideas in motion</p>
        <h1 className="font-serif text-3xl">Roadmap</h1>
        <p className="max-w-prose text-muted">
          See what is being considered, what is underway, and what has shipped.
          Plans can change as the team learns.
        </p>
      </div>
      <RoadmapBoard workspace={workspace.slug} columns={columns} />
    </WorkspaceShell>
  );
}
