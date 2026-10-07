import { notFound, permanentRedirect } from "next/navigation";
import { loadFeedbackContext } from "@/lib/feedback-runtime";
import { FeedbackDetail } from "@/components/feedback/feedback-views";
import {
  WorkspaceShell,
  FeedbackAccessNotice,
} from "@/components/feedback/workspace-shell";
import { feedbackPath } from "@/components/feedback/paths";
import { engagementServices } from "@/lib/engagement-runtime";
import { EngagementControls } from "@/components/feedback/engagement-controls";
import { CommentThread } from "@/components/feedback/comment-thread";
import { moderationService } from "@/lib/moderation-runtime";
import { ModerationPanel } from "@/components/moderation/moderation-panel";
import { MergedHistory } from "@/components/moderation/merged-history";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export default safePage(FeedbackDetailPage);
async function FeedbackDetailPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/feedback/[slug]">) {
  const path = await params;
  const context = await loadFeedbackContext(path.workspace);
  if (!context.ok) {
    if (context.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={context.error.code} />;
  }
  const { workspace, actor, service } = context.value;
  const locale = await getLocale();
  const moderation = moderationService();
  const redirect = await moderation.redirect(actor, workspace.id, path.slug);
  if (!redirect.ok) return <FeedbackAccessNotice code={redirect.error.code} />;
  if (redirect.value)
    permanentRedirect(
      `${feedbackPath(workspace.slug)}/${encodeURIComponent(redirect.value.slug)}`,
    );
  const detail = await service.detail(actor, workspace.id, path.slug);
  if (!detail.ok) {
    if (detail.error.code === "NOT_FOUND") notFound();
    return <FeedbackAccessNotice code={detail.error.code} />;
  }
  let discussion = null;
  let earlierConversations = null;
  let moderatorTools = null;
  if (actor && actor.role !== "member") {
    const [taxonomy, selection] = await Promise.all([
      service.taxonomy(actor, workspace.id),
      moderation.taxonomySelection(actor, workspace.id, detail.value.id),
    ]);
    if (taxonomy.ok && selection.ok)
      moderatorTools = (
        <ModerationPanel
          key={`${detail.value.id}-${detail.value.visibility}-${detail.value.status}-${selection.value.tagIds.join(",")}`}
          workspace={workspace.slug}
          item={detail.value}
          taxonomy={taxonomy.value}
          tagIds={selection.value.tagIds}
          locale={locale}
        />
      );
  }
  if (detail.value.visibility === "published") {
    const { engagement } = engagementServices();
    const [state, comments] = await Promise.all([
      engagement.state(actor, workspace.id, detail.value.id),
      engagement.listComments(actor, workspace.id, detail.value.id),
    ]);
    discussion =
      state.ok && comments.ok ? (
        <>
          <EngagementControls
            key={`engagement-${actor?.memberId ?? "public"}`}
            workspace={workspace.slug}
            feedbackId={detail.value.id}
            initial={state.value}
            canEngage={!!actor}
            locale={locale}
          />
          <CommentThread
            key={`comments-${actor?.memberId ?? "public"}`}
            workspace={workspace.slug}
            feedbackId={detail.value.id}
            initial={comments.value}
            canComment={!!actor}
            locale={locale}
          />
        </>
      ) : (
        <p className="mt-8 text-muted">
          {locale === "zh"
            ? "这条反馈暂时没有讨论内容。"
            : "Discussion is not available for this feedback."}
        </p>
      );
    const search = await searchParams;
    const history = await moderation.history(
      actor,
      workspace.id,
      detail.value.id,
      search.historyCursor ? { cursor: search.historyCursor } : {},
    );
    earlierConversations = history.ok ? (
      <MergedHistory
        page={history.value}
        detailPath={`${feedbackPath(workspace.slug)}/${encodeURIComponent(path.slug)}`}
        locale={locale}
      />
    ) : (
      <p className="mt-8 text-muted">
        {locale === "zh"
          ? "之前的讨论暂时无法加载，请返回反馈详情后重试。"
          : "Earlier conversations could not be loaded. Return to this feedback without the history filter and try again."}
      </p>
    );
  }
  return (
    <WorkspaceShell
      workspace={workspace}
      moderator={!!actor && actor.role !== "member"}
      locale={locale}
    >
      <a
        href={feedbackPath(workspace.slug)}
        className="mb-6 inline-block py-2 text-sm underline"
      >
        {locale === "zh" ? "返回反馈" : "Back to feedback"}
      </a>
      <FeedbackDetail item={detail.value} locale={locale} />
      {moderatorTools}
      {discussion}
      {earlierConversations}
    </WorkspaceShell>
  );
}
import { safePage } from "@/lib/security/render-boundary";
