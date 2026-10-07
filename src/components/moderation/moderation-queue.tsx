import type { FeedbackPage } from "@/features/feedback/types";
import { feedbackPath } from "@/components/feedback/paths";
import type { Locale } from "@/lib/i18n";
export function ModerationQueue({
  workspace,
  page,
  locale = "en",
}: {
  workspace: string;
  page: FeedbackPage;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  const base = feedbackPath(workspace);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="console-kicker text-action">
          {zh ? "审核 / 收件箱" : "MODERATION / INBOX"}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">
          {zh ? "审核队列" : "Review queue"}
        </h1>
        <p className="max-w-prose text-muted">
          {zh
            ? "查看反馈背景，发布有价值的建议，并合并重复内容。"
            : "Read the context, publish useful suggestions, and bring duplicates into one conversation."}
        </p>
      </div>
      {page.items.length ? (
        <>
          <div
            className="hidden grid-cols-[minmax(0,1fr)_8rem_7rem] gap-6 border-b border-rule pb-3 text-sm font-semibold sm:grid"
            aria-hidden="true"
          >
            <span>{zh ? "反馈" : "Suggestion"}</span>
            <span>{zh ? "提交时间" : "Submitted"}</span>
            <span>{zh ? "操作" : "Action"}</span>
          </div>
          <ol className="console-panel divide-y divide-rule px-5">
            {page.items.map((item) => (
              <li
                key={item.id}
                className="dense-row grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:gap-6"
              >
                <div className="grid min-w-0 gap-2">
                  <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">
                    {item.title}
                  </h2>
                  <p className="text-sm text-muted">
                    {item.status === "closed"
                      ? zh
                        ? "已关闭 · 不公开"
                        : "Closed · not public"
                      : zh
                        ? "等待审核 · 不公开"
                        : "Awaiting review · not public"}
                  </p>
                </div>
                <time
                  className="text-sm text-muted"
                  dateTime={item.createdAt.toISOString()}
                >
                  {item.createdAt.toLocaleDateString(zh ? "zh-CN" : "en-US", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </time>
                <a
                  className="inline-flex min-h-11 items-center self-start underline"
                  href={`${base}/${encodeURIComponent(item.slug)}`}
                >
                  {zh ? "审核反馈" : "Review idea"}
                  <span className="sr-only">: {item.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <section className="console-panel grid gap-3 p-8">
          <h2 className="text-2xl font-semibold">
            {zh ? "暂无待审核内容。" : "Nothing waiting for review."}
          </h2>
          <p className="text-muted">
            {zh
              ? "新的成员提交会显示在这里，也可以从已发布的反馈中调整状态或合并重复内容。"
              : "New member submissions will appear here. You can also change status or merge duplicates from any published idea."}
          </p>
          <a href={base} className="w-fit py-2 underline">
            {zh ? "浏览已发布反馈" : "Browse published feedback"}
          </a>
        </section>
      )}
      {page.nextCursor && (
        <a
          href={`/${encodeURIComponent(workspace)}/admin/moderation?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="w-fit py-2 underline"
        >
          {zh ? "更多提交" : "More submissions"}
        </a>
      )}
    </div>
  );
}
