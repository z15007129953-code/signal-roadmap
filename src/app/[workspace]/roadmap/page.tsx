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
import { getLocale } from "@/lib/i18n-server";
export const dynamic = "force-dynamic";
export default safePage(RoadmapPage);
async function RoadmapPage({
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
  const locale = await getLocale();
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
      locale={locale}
    >
      <div className="mb-10 grid gap-3">
        <p className="text-sm text-muted">
          {locale === "zh" ? "反馈 / 进展" : "FEEDBACK / PROGRESS"}
        </p>
        <h1 className="font-serif text-3xl">
          {locale === "zh" ? "路线图" : "Roadmap"}
        </h1>
        <p className="max-w-prose text-muted">
          {locale === "zh"
            ? "查看正在考虑、进行中和已经完成的工作。计划会随着新信息持续调整。"
            : "See what is being considered, what is underway, and what has shipped. Plans can change as the team learns."}
        </p>
      </div>
      <RoadmapBoard
        workspace={workspace.slug}
        columns={columns}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
import { safePage } from "@/lib/security/render-boundary";
