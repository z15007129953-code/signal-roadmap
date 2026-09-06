import Markdown from "react-markdown";
import type {
  FeedbackFilters,
  FeedbackItem,
  FeedbackPage,
  FeedbackTaxonomy,
  FeedbackStatus,
} from "@/features/feedback/types";
import { feedbackPath } from "./paths";

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
export function FeedbackStatusLabel({ status }: { status: FeedbackStatus }) {
  return (
    <span className={`text-sm font-semibold ${statuses[status].className}`}>
      {statuses[status].label}
    </span>
  );
}
function FeedbackDate({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} className="text-sm text-muted">
      {new Intl.DateTimeFormat("en", {
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
}: {
  workspace: string;
  taxonomy: FeedbackTaxonomy;
  filters: Partial<FeedbackFilters>;
  page: FeedbackPage;
}) {
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
          <p className="text-sm text-muted">Community noticeboard</p>
          <h1 className="font-serif text-3xl">
            {filters.visibility === "pending" ? "Awaiting review" : "Feedback"}
          </h1>
        </div>
        <a
          href={`${path}/new`}
          className="inline-flex min-h-11 items-center rounded-sm bg-action px-5 py-2 font-semibold text-action-foreground"
        >
          Share feedback
        </a>
      </div>
      <form
        action={path}
        method="get"
        role="search"
        className="mb-8 grid gap-4 border-y border-rule py-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="grid gap-1 sm:col-span-2">
          <label htmlFor="search" className="text-sm font-medium">
            Search feedback
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
            Board
          </label>
          <select
            id="board-filter"
            name="boardId"
            defaultValue={filters.boardId ?? ""}
            className={control}
          >
            <option value="">All boards</option>
            {taxonomy.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status-filter"
            name="status"
            defaultValue={filters.status ?? ""}
            className={control}
          >
            <option value="">All statuses</option>
            {Object.entries(statuses).map(([value, status]) => (
              <option key={value} value={value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        {taxonomy.tags.length > 0 && (
          <div className="grid gap-1">
            <label htmlFor="tag-filter" className="text-sm font-medium">
              Tag
            </label>
            <select
              id="tag-filter"
              name="tagId"
              defaultValue={filters.tagId ?? ""}
              className={control}
            >
              <option value="">All tags</option>
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
            Apply filters
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
              Clear filters
            </a>
          )}
        </div>
      </form>
      {page.items.length ? (
        <ol className="divide-y divide-rule border-b border-rule">
          {page.items.map((item) => (
            <li
              key={item.id}
              className="grid min-w-0 gap-3 py-6 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-8"
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
                <FeedbackDate date={item.createdAt} />
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:pt-1">
                <FeedbackStatusLabel status={item.status} />
                {item.visibility === "pending" && (
                  <span className="text-sm text-muted">Not public</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <section className="grid gap-3 py-10">
          <h2 className="font-serif text-2xl">
            {filtered
              ? "No feedback matches these filters."
              : filters.visibility === "pending"
                ? "Nothing awaiting review."
                : "A good idea starts a conversation."}
          </h2>
          <p className="max-w-prose text-muted">
            {filtered
              ? "Try fewer filters or search with a different phrase."
              : filters.visibility === "pending"
                ? "New member submissions will appear here for review."
                : "This board is ready for its first suggestion. Tell the team what would make your day easier."}
          </p>
        </section>
      )}
      {page.nextCursor && (
        <a
          className="mt-6 inline-flex min-h-11 items-center underline"
          href={`${path}?${query}`}
        >
          Older feedback
        </a>
      )}
    </>
  );
}
export function FeedbackDetail({ item }: { item: FeedbackItem }) {
  return (
    <article className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FeedbackStatusLabel status={item.status} />
        <FeedbackDate date={item.createdAt} />
      </div>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight [overflow-wrap:anywhere]">
        {item.title}
      </h1>
      {item.visibility === "pending" && (
        <aside className="grid gap-1 border border-rule bg-panel-muted p-4">
          <h2 className="font-semibold">Awaiting review</h2>
          <p className="text-sm">
            Only the author and workspace moderators can see this feedback. It
            is not on the public board yet.
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
