import { notFound } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { roadmapServices } from "@/lib/roadmap-runtime";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { ChangelogList } from "@/components/roadmap/changelog-views";
import { getLocale } from "@/lib/i18n-server";
export const dynamic = "force-dynamic";
export default safePage(ChangelogPage);
async function ChangelogPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/changelog">) {
  const { workspace: slug } = await params;
  const context = await loadFeedbackContext(slug);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor } = context.value;
  const locale = await getLocale();
  const search = await searchParams;
  const result = await roadmapServices().changelog.list(actor, workspace.id, {
    visibility: "published",
    limit: 20,
    ...(search.cursor ? { cursor: search.cursor } : {}),
  });
  if (!result.ok) return <FeedbackAccessNotice code={result.error.code} />;
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
      locale={locale}
    >
      <div className="mb-8 grid gap-3">
        <p className="text-sm text-muted">
          {locale === "zh" ? "了解产品变化" : "What changed, and why"}
        </p>
        <h1 className="font-serif text-3xl">
          {locale === "zh" ? "更新日志" : "Changelog"}
        </h1>
        <p className="max-w-prose text-muted">
          {locale === "zh"
            ? "查看一个想法如何变成已经上线的改进。"
            : "Follow the work from a community idea to a shipped improvement."}
        </p>
      </div>
      <ChangelogList
        workspace={workspace.slug}
        page={result.value}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
import { safePage } from "@/lib/security/render-boundary";
