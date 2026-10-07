import type { FeedbackPage, FeedbackStatus } from "@/features/feedback/types";
import { t, type Locale } from "@/lib/i18n";
export const roadmapLabels: Record<FeedbackStatus, string> = {
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
};
export function RoadmapBoard({
  workspace,
  columns,
  locale = "en",
}: {
  workspace: string;
  columns: Record<FeedbackStatus, FeedbackPage>;
  locale?: Locale;
}) {
  const translated = t(locale).status;
  const labels: Record<FeedbackStatus, string> = {
    under_review: translated.reviewing,
    planned: translated.planned,
    in_progress: translated.inProgress,
    completed: translated.completed,
    closed: translated.closed,
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {(Object.keys(labels) as FeedbackStatus[]).map((status) => (
        <section
          id={status}
          key={status}
          aria-labelledby={`roadmap-${status}`}
          className="console-panel min-w-0 scroll-mt-6 p-4"
        >
          <h2
            id={`roadmap-${status}`}
            className="border-b border-rule pb-3 text-sm font-semibold tracking-[0.06em]"
          >
            {labels[status]}
          </h2>
          {columns[status].items.length ? (
            <ol className="mt-2 divide-y divide-rule">
              {columns[status].items.map((item) => (
                <li key={item.id} className="py-4">
                  <a
                    className="block min-h-11 text-sm leading-snug font-medium hover:text-action [overflow-wrap:anywhere]"
                    href={`/${encodeURIComponent(workspace)}/feedback/${encodeURIComponent(item.slug)}`}
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-sm text-muted">
              {locale === "zh" ? "这里还没有反馈。" : "No ideas here yet."}
            </p>
          )}
          {columns[status].nextCursor && (
            <a
              className="mt-3 inline-flex min-h-11 items-center text-sm underline"
              href={`/${encodeURIComponent(workspace)}/roadmap?status=${status}&cursor=${encodeURIComponent(columns[status].nextCursor)}#${status}`}
            >
              {locale === "zh"
                ? `更多${labels[status]}反馈`
                : `More ${roadmapLabels[status].toLowerCase()} ideas`}
            </a>
          )}
        </section>
      ))}
    </div>
  );
}
