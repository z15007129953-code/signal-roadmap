import Markdown from "react-markdown";
import type {
  FeedbackFilters,
  FeedbackItem,
  FeedbackPage,
  FeedbackTaxonomy,
  FeedbackStatus,
} from "@/features/feedback/types";
import { feedbackPath } from "./paths";
import { t, type Locale } from "@/lib/i18n";

const statuses: Record<FeedbackStatus, { label: string; className: string }> = {
  under_review: {
    label: "Under review",
    className: "text-status-under-review",
  },
  planned: { label: "Planned", className: "text-status-planned" },
  in_progress: { label: "In progress", className: "text-status-in-progress" },
  completed: { label: "Completed", className: "text-status-completed" },
  closed: { label: "Closed", className: "text-status-closed" },
};
export function FeedbackStatusLabel({
  status,
  locale = "en",
}: {
  status: FeedbackStatus;
  locale?: Locale;
}) {
  const translated = t(locale).status;
  const label = {
    under_review: translated.reviewing,
    planned: translated.planned,
    in_progress: translated.inProgress,
    completed: translated.completed,
    closed: translated.closed,
  }[status];
  return (
    <span className={`status-tag ${statuses[status].className}`}>{label}</span>
  );
}
function FeedbackDate({
  date,
  locale = "en",
}: {
  date: Date;
  locale?: Locale;
}) {
  return (
    <time dateTime={date.toISOString()} className="text-sm text-muted">
      {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date)}
    </time>
  );
}
export function FeedbackList({
  workspace,
  taxonomy,
  filters,
  page,
  locale = "en",
}: {
  workspace: string;
  taxonomy: FeedbackTaxonomy;
  filters: Partial<FeedbackFilters>;
  page: FeedbackPage;
  locale?: Locale;
}) {
  const copy = t(locale);
  const zh = locale === "zh";
  const path = feedbackPath(workspace);
  const query = new URLSearchParams();
  if (filters.query) query.set("q", filters.query);
  for (const key of ["boardId", "tagId", "status", "visibility"] as const)
    if (filters[key]) query.set(key, filters[key]);
  if (page.nextCursor) query.set("cursor", page.nextCursor);
  const filtered = !!(
    filters.query ||
    filters.boardId ||
    filters.tagId ||
    filters.status
  );
  const control =
    "min-h-11 w-full rounded-sm border border-control bg-panel px-3 py-2";
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="console-kicker text-action">
            {zh ? "反馈 / 收件箱" : "FEEDBACK / INBOX"}
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">
            {filters.visibility === "pending"
              ? copy.status.reviewing
              : copy.shell.feedback}
          </h1>
        </div>
        <a
          href={`${path}/new`}
          className="inline-flex min-h-11 items-center rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground"
        >
          {zh ? "提交反馈" : "Share feedback"}
        </a>
      </div>
      <form
        action={path}
        method="get"
        role="search"
        className="console-panel mb-8 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="grid gap-1 sm:col-span-2">
          <label htmlFor="search" className="text-sm font-medium">
            {zh ? "搜索反馈" : "Search feedback"}
          </label>
          <input
            id="search"
            name="q"
            type="search"
            maxLength={140}
            defaultValue={filters.query}
            className={control}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="board-filter" className="text-sm font-medium">
            {zh ? "主题" : "Board"}
          </label>
          <select
            id="board-filter"
            name="boardId"
            defaultValue={filters.boardId ?? ""}
            className={control}
          >
            <option value="">{zh ? "全部主题" : "All boards"}</option>
            {taxonomy.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium">
            {zh ? "状态" : "Status"}
          </label>
          <select
            id="status-filter"
            name="status"
            defaultValue={filters.status ?? ""}
            className={control}
          >
            <option value="">
              {locale === "zh" ? "全部状态" : "All statuses"}
            </option>
            {Object.entries(statuses).map(([value, status]) => (
              <option key={value} value={value}>
                {zh
                  ? (
                      {
                        under_review: "审核中",
                        planned: "已计划",
                        in_progress: "进行中",
                        completed: "已完成",
                        closed: "已关闭",
                      } as Record<string, string>
                    )[value]
                  : status.label}
              </option>
            ))}
          </select>
        </div>
        {taxonomy.tags.length > 0 && (
          <div className="grid gap-1">
            <label htmlFor="tag-filter" className="text-sm font-medium">
              {zh ? "标签" : "Tag"}
            </label>
            <select
              id="tag-filter"
              name="tagId"
              defaultValue={filters.tagId ?? ""}
              className={control}
            >
              <option value="">{zh ? "全部标签" : "All tags"}</option>
              {taxonomy.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {filters.visibility === "pending" && (
          <input type="hidden" name="visibility" value="pending" />
        )}
        <div className="flex items-end gap-4">
          <button
            className="min-h-11 rounded-sm border border-control px-4 py-2 font-medium"
            type="submit"
          >
            {zh ? "应用筛选" : "Apply filters"}
          </button>
          {filtered && (
            <a
              className="py-2 underline"
              href={
                filters.visibility === "pending"
                  ? `${path}?visibility=pending`
                  : path
              }
            >
              {zh ? "清除筛选" : "Clear filters"}
            </a>
          )}
        </div>
      </form>
      {page.items.length ? (
        <ol className="divide-y divide-rule border-b border-rule">
          {page.items.map((item) => (
            <li
              key={item.id}
              className="dense-row grid min-w-0 gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-8"
            >
              <div className="grid min-w-0 gap-2">
                <h2 className="text-xl leading-snug font-semibold [overflow-wrap:anywhere]">
                  <a
                    className="block py-1 hover:underline"
                    href={`${path}/${encodeURIComponent(item.slug)}`}
                  >
                    {item.title}
                  </a>
                </h2>
                <FeedbackDate date={item.createdAt} locale={locale} />
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:pt-1">
                <FeedbackStatusLabel status={item.status} locale={locale} />
                {item.visibility === "pending" && (
                  <span className="text-sm text-muted">
                    {zh ? "暂不公开" : "Not public"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <section className="console-panel grid gap-3 p-8">
          <h2 className="text-2xl font-semibold">
            {filtered
              ? zh
                ? "没有符合条件的反馈。"
                : "No feedback matches these filters."
              : filters.visibility === "pending"
                ? zh
                  ? "暂无待审核反馈。"
                  : "Nothing awaiting review."
                : zh
                  ? "好的想法，从一次对话开始。"
                  : "A good idea starts a conversation."}
          </h2>
          <p className="max-w-prose text-muted">
            {filtered
              ? zh
                ? "减少筛选条件，或换个关键词试试。"
                : "Try fewer filters or search with a different phrase."
              : filters.visibility === "pending"
                ? zh
                  ? "新的成员反馈会在这里等待审核。"
                  : "New member submissions will appear here for review."
                : zh
                  ? "提交第一条反馈，告诉团队什么可以让你的工作更轻松。"
                  : "This board is ready for its first suggestion. Tell the team what would make your day easier."}
          </p>
        </section>
      )}
      {page.nextCursor && (
        <a
          className="mt-6 inline-flex min-h-11 items-center underline"
          href={`${path}?${query}`}
        >
          {zh ? "更早的反馈" : "Older feedback"}
        </a>
      )}
    </>
  );
}
export function FeedbackDetail({
  item,
  locale = "en",
}: {
  item: FeedbackItem;
  locale?: Locale;
}) {
  const zh = locale === "zh";
  return (
    <article className="console-panel grid min-w-0 gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FeedbackStatusLabel status={item.status} locale={locale} />
        <FeedbackDate date={item.createdAt} locale={locale} />
      </div>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight [overflow-wrap:anywhere]">
        {item.title}
      </h1>
      {item.visibility === "pending" && (
        <aside className="console-panel-muted grid gap-1 p-4">
          <h2 className="font-semibold">
            {zh ? "等待审核" : "Awaiting review"}
          </h2>
          <p className="text-sm">
            {zh
              ? "发布前只有作者和工作区管理员可以查看，暂时不会出现在公开反馈列表中。"
              : "Only the author and workspace moderators can see this feedback. It is not on the public board yet."}
          </p>
        </aside>
      )}
      <div className="feedback-markdown max-w-prose border-t border-rule pt-6 [overflow-wrap:anywhere]">
        <Markdown
          skipHtml
          disallowedElements={["img"]}
          components={{
            a: ({ children, href }) => (
              <a href={href} rel="nofollow noreferrer noopener">
                {children}
              </a>
            ),
          }}
        >
          {item.body}
        </Markdown>
      </div>
    </article>
  );
}
